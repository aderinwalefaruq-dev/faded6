export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  role: UserRole;
  created_at: string;
}

export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface EventRecord {
  id: string;
  host_id: string;
  title: string;
  slug: string;
  description: string;
  event_date: string;
  venue: string;
  banner_url: string | null;
  status: EventStatus;
  created_at: string;
}

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  price_ngn: number;
  quantity_total: number;
  quantity_sold: number;
  sort_order: number;
  created_at: string;
}

export type OrderStatus = 'pending' | 'paid' | 'failed';

export interface OrderRecord {
  id: string;
  event_id: string;
  reference: string;
  buyer_name: string;
  buyer_email: string;
  subtotal_ngn: number;
  service_fee_ngn: number;
  total_ngn: number;
  status: OrderStatus;
  paystack_reference: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  tier_id: string;
  tier_name: string;
  unit_price_ngn: number;
  quantity: number;
}

export interface TicketRecord {
  id: string;
  order_id: string;
  event_id: string;
  tier_id: string;
  tier_name: string;
  buyer_name: string;
  buyer_email: string;
  ticket_code: string;
  is_checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
}

export interface EventWithTiers extends EventRecord {
  ticket_tiers: TicketTier[];
}

export interface OrderBundle {
  order: OrderRecord;
  items: OrderItem[];
  tickets: TicketRecord[];
  event: Pick<EventRecord, 'id' | 'title' | 'slug' | 'event_date' | 'venue' | 'banner_url'> | null;
}

export interface ScanResult {
  result: 'valid' | 'already_used' | 'invalid' | 'wrong_event';
  ticket?: {
    ticket_code: string;
    buyer_name: string;
    tier_name: string;
    is_checked_in: boolean;
    checked_in_at: string | null;
  };
  message?: string;
}
