import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { loadOrderBundle } from './orders.ts';
import { sendTicketEmail } from './email.ts';

export function isSoldOut(error: unknown): boolean {
  return String((error as { message?: string })?.message ?? '').includes('SOLD_OUT');
}

/**
 * Issues the tickets for an order (idempotent — finalize_order locks the row) and,
 * only when THIS call is the one that issued them, emails the buyer. That keeps
 * verify-payment, the Paystack webhook and free checkouts from double-sending.
 */
export async function finalizeAndNotify(
  supabase: SupabaseClient,
  reference: string,
  paystackRef: string | null,
): Promise<{ finalized: boolean }> {
  const { data, error } = await supabase.rpc('finalize_order', {
    p_reference: reference,
    p_paystack_ref: paystackRef,
  });
  if (error) throw error;

  const finalized = (data as { status?: string } | null)?.status === 'paid';
  if (!finalized) return { finalized: false };

  try {
    const bundle = await loadOrderBundle(supabase, reference, { exposeEmail: true });
    if (bundle?.event && bundle.tickets.length > 0) {
      await sendTicketEmail({
        to: String(bundle.order.buyer_email ?? ''),
        buyerName: String(bundle.order.buyer_name ?? ''),
        eventTitle: String(bundle.event.title ?? ''),
        eventDate: String(bundle.event.event_date ?? ''),
        venue: String(bundle.event.venue ?? ''),
        reference,
        totalNgn: Number(bundle.order.total_ngn ?? 0),
        tickets: bundle.tickets.map((ticket) => ({
          ticket_code: String(ticket.ticket_code ?? ''),
          tier_name: String(ticket.tier_name ?? ''),
          buyer_name: String(ticket.buyer_name ?? ''),
        })),
      });
    }
  } catch (emailError) {
    // Tickets are already issued; a failed email must never fail the payment.
    console.error('Ticket email failed:', emailError instanceof Error ? emailError.message : emailError);
  }

  return { finalized: true };
}
