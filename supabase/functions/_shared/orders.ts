import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const SERVICE_FEE_NGN = 350;

export interface OrderBundle {
  order: Record<string, unknown>;
  items: Record<string, unknown>[];
  tickets: Record<string, unknown>[];
  event: Record<string, unknown> | null;
}

/** j***@gmail.com — public order/ticket pages must not leak full buyer emails. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function loadOrderBundle(
  supabase: SupabaseClient,
  reference: string,
  options: { exposeEmail?: boolean } = {},
): Promise<OrderBundle | null> {
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, event_id, reference, buyer_name, buyer_email, subtotal_ngn, service_fee_ngn, total_ngn, status, paystack_reference, created_at, paid_at',
    )
    .eq('reference', reference)
    .maybeSingle();

  if (error) throw error;
  if (!order) return null;

  const [{ data: items }, { data: tickets }, { data: event }] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, order_id, tier_id, tier_name, unit_price_ngn, quantity')
      .eq('order_id', order.id)
      .order('tier_name', { ascending: true })
      .limit(50),
    supabase
      .from('tickets')
      .select(
        'id, order_id, event_id, tier_id, tier_name, buyer_name, buyer_email, ticket_code, is_checked_in, checked_in_at, created_at',
      )
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })
      .limit(100),
    supabase
      .from('events')
      .select('id, title, slug, event_date, venue, banner_url')
      .eq('id', order.event_id)
      .maybeSingle(),
  ]);

  const hide = !options.exposeEmail;
  const ticketRows = Array.isArray(tickets) ? tickets : [];

  return {
    order: hide ? { ...order, buyer_email: maskEmail(String(order.buyer_email ?? '')) } : order,
    items: Array.isArray(items) ? items : [],
    tickets: hide
      ? ticketRows.map((row) => ({ ...row, buyer_email: maskEmail(String(row.buyer_email ?? '')) }))
      : ticketRows,
    event: event ?? null,
  };
}
