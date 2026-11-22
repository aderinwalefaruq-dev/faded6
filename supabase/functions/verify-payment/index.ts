import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { loadOrderBundle } from '../_shared/orders.ts';
import { finalizeAndNotify, isSoldOut } from '../_shared/finalize.ts';

// Paystack reports these while a transfer / USSD / bank payment is still settling.
const PENDING_STATES = new Set(['ongoing', 'pending', 'processing', 'queued']);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PaystackResult =
  | { kind: 'success'; data: Record<string, unknown> }
  | { kind: 'pending' }
  | { kind: 'failed' };

/** Asks Paystack about a transaction, retrying briefly while it is still settling. */
async function checkWithPaystack(reference: string, secretKey: string): Promise<PaystackResult> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(1500);

    let response: Response;
    try {
      response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } },
      );
    } catch (networkError) {
      console.error('Paystack verify network error:', networkError);
      continue;
    }

    const payload = await response.json().catch(() => null);
    const status = String(payload?.data?.status ?? '');

    if (response.ok && payload?.status && status === 'success') {
      return { kind: 'success', data: payload.data };
    }
    if (response.status >= 500 || (response.ok && PENDING_STATES.has(status))) continue;
    return { kind: 'failed' };
  }
  return { kind: 'pending' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const reference = String(body?.reference ?? '').trim();
    if (!reference) return json({ error: 'Missing order reference' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, reference, status, total_ngn')
      .eq('reference', reference)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: 'Order not found' }, 404);

    if (order.status === 'paid') {
      const existing = await loadOrderBundle(supabase, reference);
      return json({ ...existing, already_paid: true });
    }

    let paystackRef: string | null = null;

    if (order.total_ngn > 0) {
      const secretKey = (Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').trim();
      if (!secretKey) {
        console.error('PAYSTACK_SECRET_KEY is missing — refusing to finalize a paid order');
        return json(
          { error: 'Payments are not configured on this server. Please contact the organiser.' },
          503,
        );
      }

      const result = await checkWithPaystack(reference, secretKey);

      if (result.kind === 'pending') {
        return json(
          {
            error: 'Your payment is still being confirmed. This page will update automatically.',
            pending: true,
          },
          402,
        );
      }
      if (result.kind === 'failed') {
        return json({ error: 'Payment could not be verified' }, 402);
      }

      const { data } = result;
      if (Number(data.amount) !== order.total_ngn * 100) {
        console.error('Amount mismatch for', reference, data.amount, order.total_ngn * 100);
        return json({ error: 'Payment amount did not match the order total' }, 402);
      }
      if (String(data.currency ?? 'NGN').toUpperCase() !== 'NGN') {
        return json({ error: 'Unexpected payment currency' }, 402);
      }

      paystackRef = String(data.reference ?? reference);
    }

    let finalized = false;
    try {
      ({ finalized } = await finalizeAndNotify(supabase, reference, paystackRef));
    } catch (finalizeError) {
      if (isSoldOut(finalizeError)) {
        console.error('REFUND_NEEDED: paid but sold out —', reference);
        return json({ error: 'Those tickets just sold out. Please contact the organiser for a refund.' }, 409);
      }
      throw finalizeError;
    }

    const bundle = await loadOrderBundle(supabase, reference);
    return json({ ...bundle, already_paid: !finalized });
  } catch (error) {
    console.error('verify-payment failed:', error instanceof Error ? error.message : error);
    return json({ error: 'We could not confirm this payment. Please contact support.' }, 500);
  }
});
