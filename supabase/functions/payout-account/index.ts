import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';

/**
 * Host bank-account endpoint (signed-in hosts only).
 *   { action: 'banks' }                                   -> list of Nigerian banks from Paystack
 *   { action: 'save', bank_code, account_number, account_name? }
 *        -> asks Paystack who owns the account. If it resolves, the real account name is stored
 *           and marked verified. If Paystack can't resolve it, the host must type the name
 *           (stored as unverified, and flagged to the admin).
 * Written with the service role so the "verified" flag can't be forged from the browser.
 */
type Bank = { name: string; code: string };

async function fetchBanks(secretKey: string): Promise<Bank[]> {
  const byCode = new Map<string, Bank>();
  for (let page = 1; page <= 6; page += 1) {
    const response = await fetch(
      `https://api.paystack.co/bank?country=nigeria&currency=NGN&perPage=100&page=${page}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload?.data)) {
      if (page === 1) throw new Error('Could not load the bank list');
      break;
    }
    for (const row of payload.data) {
      if (row?.active === false || !row?.code || !row?.name) continue;
      const code = String(row.code);
      if (!byCode.has(code)) byCode.set(code, { name: String(row.name), code });
    }
    if (payload.data.length < 100) break;
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function resolveAccountName(
  secretKey: string,
  accountNumber: string,
  bankCode: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const payload = await response.json().catch(() => null);
    const name = payload?.data?.account_name;
    return response.ok && payload?.status && typeof name === 'string' && name.trim()
      ? name.trim()
      : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sign in first' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Sign in first' }, 401);

    const secretKey = (Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').trim();
    if (!secretKey) return json({ error: 'Payments are not configured on this server.' }, 503);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');

    if (action === 'banks') {
      return json({ banks: await fetchBanks(secretKey) });
    }

    if (action === 'save') {
      const bankCode = String(body?.bank_code ?? '').trim();
      const accountNumber = String(body?.account_number ?? '').replace(/\s+/g, '');
      const typedName = String(body?.account_name ?? '').trim().replace(/\s+/g, ' ');

      if (!bankCode) return json({ error: 'Choose your bank' }, 400);
      if (!/^\d{10}$/.test(accountNumber)) {
        return json({ error: 'Account number must be exactly 10 digits' }, 400);
      }

      const banks = await fetchBanks(secretKey);
      const bank = banks.find((row) => row.code === bankCode);
      if (!bank) return json({ error: 'That bank is not supported' }, 400);

      const resolvedName = await resolveAccountName(secretKey, accountNumber, bankCode);
      let accountName: string;
      let verified: boolean;

      if (resolvedName) {
        accountName = resolvedName;
        verified = true;
      } else if (typedName.length >= 3 && typedName.length <= 100) {
        accountName = typedName;
        verified = false;
      } else {
        return json({
          status: 'needs_name',
          message:
            'We could not verify this account automatically. Enter the account name exactly as your bank shows it.',
        });
      }

      const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      const { data: existing } = await supabase
        .from('payout_accounts')
        .select('*')
        .eq('host_id', user.id)
        .maybeSingle();

      if (
        existing &&
        existing.bank_code === bankCode &&
        existing.account_number === accountNumber &&
        existing.account_name === accountName
      ) {
        return json({ status: 'saved', account: existing });
      }

      const { data: saved, error: saveError } = await supabase
        .from('payout_accounts')
        .upsert(
          {
            host_id: user.id,
            bank_code: bankCode,
            bank_name: bank.name,
            account_number: accountNumber,
            account_name: accountName,
            name_verified: verified,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'host_id' },
        )
        .select('*')
        .single();
      if (saveError) throw saveError;

      return json({ status: 'saved', account: saved });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('payout-account failed:', error instanceof Error ? error.message : error);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
