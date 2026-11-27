import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { calculateServiceFee } from '../_shared/fees.ts';
import { finalizeAndNotify, isSoldOut } from '../_shared/finalize.ts';

interface IncomingItem {
  tier_id?: unknown;
  quantity?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.event_id ?? '').trim();
    const buyerName = String(body?.buyer_name ?? '').trim();
    const buyerEmail = String(body?.buyer_email ?? '').trim().toLowerCase();
    const rawItems: IncomingItem[] = Array.isArray(body?.items) ? body.items : [];

    if (!eventId) return json({ error: 'Missing event' }, 400);
    if (buyerName.length < 2) return json({ error: 'Please enter your full name' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
      return json({ error: 'Please enter a valid email address' }, 400);
    }
    if (rawItems.length === 0) return json({ error: 'Select at least one ticket' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, status')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return json({ error: 'Event not found' }, 404);
    if (event.status !== 'published') return json({ error: 'This event is not on sale' }, 400);

    const tierIds = [
      ...new Set(rawItems.map((item) => String(item?.tier_id ?? '')).filter(Boolean)),
    ];
    if (tierIds.length === 0) return json({ error: 'Select at least one ticket' }, 400);

    const { data: tiers, error: tierError } = await supabase
      .from('ticket_tiers')
      .select('id, name, price_ngn, quantity_total, quantity_sold')
      .eq('event_id', eventId)
      .in('id', tierIds);
    if (tierError) throw tierError;

    const tierMap = new Map((tiers ?? []).map((tier) => [tier.id, tier]));
    const items: {
      tier_id: string;
      tier_name: string;
      unit_price_ngn: number;
      quantity: number;
    }[] = [];
    let subtotal = 0;

    for (const raw of rawItems) {
      const tierId = String(raw?.tier_id ?? '');
      const quantity = Math.floor(Number(raw?.quantity ?? 0));
      if (!tierId || !Number.isFinite(quantity) || quantity <= 0) continue;

      const tier = tierMap.get(tierId);
      if (!tier) return json({ error: 'A selected ticket tier is no longer available' }, 400);

      const remaining = tier.quantity_total - tier.quantity_sold;
      if (quantity > remaining) {
        return json(
          { error: `Only ${Math.max(remaining, 0)} left for ${tier.name}` },
          409,
        );
      }

      subtotal += tier.price_ngn * quantity;
      items.push({
        tier_id: tier.id,
        tier_name: tier.name,
        unit_price_ngn: tier.price_ngn,
        quantity,
      });
    }

    if (items.length === 0) return json({ error: 'Select at least one ticket' }, 400);

    const serviceFee = calculateServiceFee(subtotal);
    const total = subtotal + serviceFee;

    const secretKey = (Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').trim();
    const publicKey = (Deno.env.get('PAYSTACK_PUBLIC_KEY') ?? '').trim();
    if (total > 0 && !secretKey) {
      // Without the secret key we could never verify the payment, so never let the buyer pay.
      console.error('PAYSTACK_SECRET_KEY is not set — blocking paid checkout');
      return json(
        { error: 'Payments are not set up yet. Please contact the organiser.' },
        503,
      );
    }

    // Paystack accepts alphanumerics plus "-", "." and "=" only, so the F6 prefix uses a hyphen.
    // The reference doubles as the buyer's ticket-wallet link, so it must not be guessable.
    const reference = `F6-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        event_id: eventId,
        reference,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        subtotal_ngn: subtotal,
        service_fee_ngn: serviceFee,
        total_ngn: total,
        status: 'pending',
      })
      .select('id, reference, total_ngn')
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: 'Could not create the order' }, 500);

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(items.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    if (total === 0) {
      try {
        await finalizeAndNotify(supabase, reference, null);
      } catch (finalizeError) {
        if (isSoldOut(finalizeError)) {
          return json({ error: 'Those tickets just sold out. Please choose another tier.' }, 409);
        }
        throw finalizeError;
      }
      return json({ status: 'paid', reference, amount_kobo: 0 });
    }

    return json({
      status: 'pending',
      reference,
      amount_kobo: total * 100,
      subtotal_ngn: subtotal,
      service_fee_ngn: serviceFee,
      total_ngn: total,
      email: buyerEmail,
      public_key: publicKey,
      payments_ready: Boolean(secretKey && publicKey),
    });
  } catch (error) {
    console.error('create-order failed:', error instanceof Error ? error.message : error);
    return json({ error: 'Could not start checkout. Please try again.' }, 500);
  }
});
