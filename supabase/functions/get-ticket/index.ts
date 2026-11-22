import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { loadOrderBundle } from '../_shared/orders.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const ticketCode = String(body?.ticket_code ?? '').trim().toUpperCase();
    if (!ticketCode) return json({ error: 'Missing ticket code' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('order_id')
      .eq('ticket_code', ticketCode)
      .maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) return json({ error: 'We could not find a ticket with that code.' }, 404);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('reference')
      .eq('id', ticket.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: 'Order not found' }, 404);

    const bundle = await loadOrderBundle(supabase, order.reference);
    if (!bundle) return json({ error: 'Order not found' }, 404);

    return json(bundle);
  } catch (error) {
    console.error('get-ticket failed:', error instanceof Error ? error.message : error);
    return json({ error: 'Could not load this ticket.' }, 500);
  }
});
