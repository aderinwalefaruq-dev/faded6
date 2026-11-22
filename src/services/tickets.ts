import { supabase } from '@/db/supabase';

export interface GuestTicketRow {
  id: string;
  order_id: string;
  event_id: string;
  tier_id: string;
  tier_name: string;
  buyer_name: string;
  buyer_email: string;
  ticket_code: string;
  amount_paid_ngn: number;
  paystack_reference: string | null;
  is_checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
}

const TICKET_FIELDS =
  'id, order_id, event_id, tier_id, tier_name, buyer_name, buyer_email, ticket_code, amount_paid_ngn, paystack_reference, is_checked_in, checked_in_at, created_at';

export async function listEventTickets(eventId: string): Promise<GuestTicketRow[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_FIELDS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;
  return Array.isArray(data) ? (data as GuestTicketRow[]) : [];
}

export async function checkInTicket(ticketId: string): Promise<string> {
  const checkedInAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('tickets')
    .update({ is_checked_in: true, checked_in_at: checkedInAt })
    .eq('id', ticketId)
    .eq('is_checked_in', false)
    .select('id, checked_in_at')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('This guest was already checked in.');
  return String(data.checked_in_at ?? checkedInAt);
}

export function buildGuestListCsv(rows: GuestTicketRow[]): string {
  const header = [
    'Buyer Name',
    'Email',
    'Ticket Tier',
    'Ticket Code',
    'Amount Paid (NGN)',
    'Paystack Reference',
    'Check-In Status',
    'Checked In At',
  ];

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const lines = rows.map((row) =>
    [
      row.buyer_name,
      row.buyer_email,
      row.tier_name,
      row.ticket_code,
      String(row.amount_paid_ngn ?? 0),
      row.paystack_reference ?? '',
      row.is_checked_in ? 'Checked In' : 'Not Scanned',
      row.checked_in_at ? new Date(row.checked_in_at).toISOString() : '',
    ]
      .map(escape)
      .join(','),
  );

  return [header.map(escape).join(','), ...lines].join('\r\n');
}

export function downloadGuestListCsv(rows: GuestTicketRow[], filename: string): void {
  const csv = buildGuestListCsv(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
