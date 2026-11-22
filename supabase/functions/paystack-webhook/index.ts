import { createClient } from 'npm:@supabase/supabase-js@2';
import { finalizeAndNotify, isSoldOut } from '../_shared/finalize.ts';

/**
 * Paystack -> server confirmation. This is what issues the ticket when a buyer pays
 * but closes the tab (or loses signal) before the browser can call verify-payment.
 *
 * Set this URL in Paystack Dashboard -> Settings -> API Keys & Webhooks:
 *   https://<project-ref>.supabase.co/functions/v1/paystack-webhook
 * Deployed with verify_jwt = false (see supabase/config.toml) — authenticity comes
 * from Paystack's HMAC-SHA512 signature instead.
 */
const encoder = new TextEncoder();

async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const ok = (message = 'ok') => new Response(message, { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secretKey = (Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').trim();
  if (!secretKey) {
    console.error('paystack-webhook: PAYSTACK_SECRET_KEY is not set');
    return new Response('Not configured', { status: 503 });
  }

  const raw = await req.text();
  const provided = (req.headers.get('x-paystack-signature') ?? '').toLowerCase();
  const expected = await sign(secretKey, raw);
  if (!safeEqual(provided, expected)) {
    return new Response('Invalid signature', { status: 401 });
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  if (event.event !== 'charge.success') return ok('ignored');

  const data = event.data ?? {};
  const reference = String(data.reference ?? '');
  // Ignore transactions that belong to other apps on the same Paystack account.
  if (!reference.startsWith('F6-')) return ok('ignored');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, status, total_ngn')
      .eq('reference', reference)
      .maybeSingle();
    if (error) throw error;
    if (!order) {
      console.error('paystack-webhook: no order for reference', reference);
      return ok('unknown order');
    }
    if (order.status === 'paid') return ok('already paid');

    if (
      Number(data.amount) !== order.total_ngn * 100 ||
      String(data.currency ?? 'NGN').toUpperCase() !== 'NGN'
    ) {
      console.error('paystack-webhook: amount/currency mismatch for', reference, data.amount, data.currency);
      return ok('mismatch');
    }

    await finalizeAndNotify(supabase, reference, reference);
    return ok();
  } catch (error) {
    if (isSoldOut(error)) {
      console.error('REFUND_NEEDED: paid but sold out —', reference);
      return ok('sold out');
    }
    console.error('paystack-webhook failed:', error instanceof Error ? error.message : error);
    // Non-200 makes Paystack retry the webhook later.
    return new Response('Server error', { status: 500 });
  }
});
