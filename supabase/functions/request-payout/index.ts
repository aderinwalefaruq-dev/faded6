import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { sendPayoutRequestEmail } from '../_shared/payout-email.ts';

/**
 * Host requests a payout (signed-in hosts only).
 *   { amount: number }
 * The balance rules live in the database (request_payout). This function runs that
 * function AS THE HOST (their own token), so the database still enforces who they are,
 * then emails the admin so a new request never goes unnoticed.
 */
const MESSAGES: Record<string, string> = {
  NO_BANK_ACCOUNT: 'Add your bank account first.',
  REQUEST_PENDING: 'You already have a payout request waiting to be processed.',
  BELOW_MINIMUM: 'That is below the minimum payout amount.',
  INSUFFICIENT_BALANCE: 'That is more than your available balance.',
  NOT_AUTHENTICATED: 'Please sign in again.',
};

function adminSiteUrl(): string | null {
  const raw = (Deno.env.get('SITE_URL') ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(raw) ? `${raw}/admin/payouts` : null;
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

    const body = await req.json().catch(() => ({}));
    const amount = Math.floor(Number(body?.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 2_000_000_000) {
      return json({ error: 'Enter a valid amount' }, 400);
    }

    const { data: request, error } = await userClient.rpc('request_payout', { p_amount: amount });
    if (error) {
      const message = String(error.message ?? '');
      const code = Object.keys(MESSAGES).find((key) => message.includes(key));
      if (code) return json({ error: MESSAGES[code] }, 400);
      console.error('request_payout failed:', message);
      return json({ error: 'Could not request the payout. Please try again.' }, 500);
    }

    // The request is saved. Alerting the admin must never undo or fail it.
    try {
      const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      const { data: host } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .maybeSingle();

      let recipients = (Deno.env.get('ADMIN_NOTIFY_EMAIL') ?? '')
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.includes('@'));

      if (recipients.length === 0) {
        const { data: admins } = await supabase.from('profiles').select('email').eq('role', 'admin');
        recipients = (admins ?? [])
          .map((row: { email: string | null }) => String(row.email ?? '').trim())
          .filter((email: string) => email.includes('@'));
      }

      const createdAt = String(request?.created_at ?? new Date().toISOString());
      const updatedAt = String(request?.account_updated_at ?? createdAt);

      await sendPayoutRequestEmail({
        recipients,
        hostName: String(host?.display_name ?? ''),
        hostEmail: String(host?.email ?? user.email ?? ''),
        amountNgn: Number(request?.amount_ngn ?? amount),
        bankName: String(request?.bank_name ?? ''),
        accountNumber: String(request?.account_number ?? ''),
        accountName: String(request?.account_name ?? ''),
        nameVerified: Boolean(request?.name_verified),
        accountChangedRecently:
          new Date(createdAt).getTime() - new Date(updatedAt).getTime() < 48 * 60 * 60 * 1000,
        accountUpdatedAt: updatedAt,
        requestedAt: createdAt,
        adminUrl: adminSiteUrl(),
      });
    } catch (notifyError) {
      console.error(
        'Payout alert email failed:',
        notifyError instanceof Error ? notifyError.message : notifyError,
      );
    }

    return json({ status: 'requested', request });
  } catch (error) {
    console.error('request-payout failed:', error instanceof Error ? error.message : error);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
