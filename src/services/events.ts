import { supabase } from '@/db/supabase';
import type { EventRecord, EventWithTiers, TicketTier } from '@/types/types';

export interface EventStats {
  tickets_sold: number;
  checked_in: number;
  orders_paid: number;
  gross_revenue_ngn: number;
  ticket_revenue_ngn: number;
  fees_ngn: number;
}

export interface HostEventSummary {
  event_id: string;
  tickets_sold: number;
  checked_in: number;
  revenue_ngn: number;
}

const EVENT_FIELDS =
  'id, host_id, title, slug, description, event_date, venue, banner_url, status, created_at';
const TIER_FIELDS =
  'id, event_id, name, price_ngn, quantity_total, quantity_sold, sort_order, created_at';

export async function listHostEvents(hostId: string): Promise<EventWithTiers[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`${EVENT_FIELDS}, ticket_tiers (${TIER_FIELDS})`)
    .eq('host_id', hostId)
    .order('event_date', { ascending: false })
    .limit(100);

  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((row) => ({
    ...(row as unknown as EventRecord),
    ticket_tiers: ((row as { ticket_tiers?: TicketTier[] }).ticket_tiers ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));
}

export async function getEventBySlug(slug: string): Promise<EventWithTiers | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`${EVENT_FIELDS}, ticket_tiers (${TIER_FIELDS})`)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...(data as unknown as EventRecord),
    ticket_tiers: ((data as { ticket_tiers?: TicketTier[] }).ticket_tiers ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  };
}

export async function getEventById(eventId: string): Promise<EventWithTiers | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`${EVENT_FIELDS}, ticket_tiers (${TIER_FIELDS})`)
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...(data as unknown as EventRecord),
    ticket_tiers: ((data as { ticket_tiers?: TicketTier[] }).ticket_tiers ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  };
}

export interface CreateEventInput {
  title: string;
  slug: string;
  description: string;
  event_date: string;
  venue: string;
  banner_url: string | null;
  tiers: { name: string; price_ngn: number; quantity_total: number }[];
}

export async function createEvent(input: CreateEventInput): Promise<EventRecord> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title: input.title,
      slug: input.slug,
      description: input.description,
      event_date: input.event_date,
      venue: input.venue,
      banner_url: input.banner_url,
      status: 'published',
    })
    .select(EVENT_FIELDS)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Event could not be created');

  const event = data as unknown as EventRecord;

  const { error: tierError } = await supabase.from('ticket_tiers').insert(
    input.tiers.map((tier, index) => ({
      event_id: event.id,
      name: tier.name,
      price_ngn: tier.price_ngn,
      quantity_total: tier.quantity_total,
      sort_order: index,
    })),
  );

  if (tierError) {
    await supabase.from('events').delete().eq('id', event.id);
    throw tierError;
  }

  return event;
}

export async function updateEvent(
  eventId: string,
  patch: Partial<Pick<EventRecord, 'title' | 'description' | 'event_date' | 'venue' | 'banner_url' | 'status'>>,
): Promise<void> {
  const { error } = await supabase.from('events').update(patch).eq('id', eventId);
  if (error) throw error;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

export async function getEventStats(eventId: string): Promise<EventStats> {
  const { data, error } = await supabase.rpc('event_stats', { p_event_id: eventId });
  if (error) throw error;

  const stats = (data ?? {}) as Partial<EventStats>;
  return {
    tickets_sold: Number(stats.tickets_sold ?? 0),
    checked_in: Number(stats.checked_in ?? 0),
    orders_paid: Number(stats.orders_paid ?? 0),
    gross_revenue_ngn: Number(stats.gross_revenue_ngn ?? 0),
    ticket_revenue_ngn: Number(stats.ticket_revenue_ngn ?? 0),
    fees_ngn: Number(stats.fees_ngn ?? 0),
  };
}

export async function getHostEventSummaries(): Promise<Record<string, HostEventSummary>> {
  const { data, error } = await supabase.rpc('host_event_summaries');
  if (error) throw error;

  const rows = Array.isArray(data) ? (data as HostEventSummary[]) : [];
  return rows.reduce<Record<string, HostEventSummary>>((acc, row) => {
    acc[row.event_id] = {
      event_id: row.event_id,
      tickets_sold: Number(row.tickets_sold ?? 0),
      checked_in: Number(row.checked_in ?? 0),
      revenue_ngn: Number(row.revenue_ngn ?? 0),
    };
    return acc;
  }, {});
}

export async function uploadEventBanner(userId: string, file: File): Promise<string> {
  const toHex = (value: string) =>
    Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('');

  const dot = file.name.lastIndexOf('.');
  const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
  const ext = dot > 0 ? file.name.slice(dot).toLowerCase() : '.jpg';
  const safeName = `${toHex(stem)}${ext}`;
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage
    .from('event-banners')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from('event-banners').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export interface EventOrderRow {
  id: string;
  reference: string;
  buyer_name: string;
  buyer_email: string;
  total_ngn: number;
  status: string;
  created_at: string;
}

export async function listEventOrders(eventId: string, limit = 20): Promise<EventOrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, reference, buyer_name, buyer_email, total_ngn, status, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return Array.isArray(data) ? (data as EventOrderRow[]) : [];
}
