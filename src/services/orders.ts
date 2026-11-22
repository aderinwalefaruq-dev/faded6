import { supabase } from '@/db/supabase';
import type { OrderBundle, ScanResult } from '@/types/types';

export interface CheckoutItem {
  tier_id: string;
  quantity: number;
}

export interface CreateOrderResponse {
  status: 'pending' | 'paid';
  reference: string;
  amount_kobo: number;
  subtotal_ngn?: number;
  service_fee_ngn?: number;
  total_ngn?: number;
  email?: string;
  public_key?: string;
  payments_ready?: boolean;
}

async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: { text?: () => Promise<string> } })?.context;
  if (context?.text) {
    try {
      const raw = await context.text();
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed?.error) return parsed.error;
    } catch {
      // fall through to the generic message
    }
  }
  return (error as Error)?.message ?? 'Something went wrong';
}

export async function createOrder(input: {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  items: CheckoutItem[];
}): Promise<CreateOrderResponse> {
  const { data, error } = await supabase.functions.invoke<CreateOrderResponse>('create-order', {
    body: {
      event_id: input.eventId,
      buyer_name: input.buyerName,
      buyer_email: input.buyerEmail,
      items: input.items,
    },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (!data) throw new Error('Checkout could not be started');
  return data;
}

export async function verifyPayment(reference: string): Promise<OrderBundle> {
  const { data, error } = await supabase.functions.invoke<OrderBundle>('verify-payment', {
    body: { reference },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (!data) throw new Error('Payment could not be confirmed');
  return data;
}

export async function getOrder(reference: string): Promise<OrderBundle> {
  const { data, error } = await supabase.functions.invoke<OrderBundle>('get-order', {
    body: { reference },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (!data) throw new Error('Order not found');
  return data;
}

export async function getTicketBundle(ticketCode: string): Promise<OrderBundle> {
  const { data, error } = await supabase.functions.invoke<OrderBundle>('get-ticket', {
    body: { ticket_code: ticketCode },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (!data) throw new Error('Ticket not found');
  return data;
}

export interface PaymentConfig {
  public_key: string;
  configured: boolean;
  mode: 'live' | 'test' | 'unknown';
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const { data, error } = await supabase.functions.invoke<PaymentConfig>('payment-config', {
    method: 'POST',
    body: {},
  });

  if (error) throw new Error(await readFunctionError(error));
  return data ?? { public_key: '', configured: false, mode: 'unknown' };
}

export async function scanTicket(eventId: string, ticketCode: string): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke<ScanResult>('scan-ticket', {
    body: { event_id: eventId, ticket_code: ticketCode },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (!data) throw new Error('Scanner did not respond');
  return data;
}
