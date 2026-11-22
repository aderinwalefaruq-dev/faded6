import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Sign in to scan tickets' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Sign in to scan tickets' }, 401);

    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.event_id ?? '').trim();
    const rawCode = String(body?.ticket_code ?? '').trim();
    if (!eventId || !rawCode) return json({ error: 'Missing event or ticket code' }, 400);

    const ticketCode = rawCode.toUpperCase();

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, host_id, title')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return json({ error: 'Event not found' }, 404);
    if (event.host_id !== user.id) return json({ error: 'You do not manage this event' }, 403);

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(
        'id, event_id, ticket_code, buyer_name, tier_name, is_checked_in, checked_in_at',
      )
      .eq('ticket_code', ticketCode)
      .maybeSingle();
    if (ticketError) throw ticketError;

    if (!ticket) {
      return json({ result: 'invalid', message: 'No ticket matches this code.' });
    }

    if (ticket.event_id !== eventId) {
      return json({
        result: 'wrong_event',
        message: 'This ticket belongs to a different event.',
      });
    }

    if (ticket.is_checked_in) {
      return json({
        result: 'already_used',
        ticket: {
          ticket_code: ticket.ticket_code,
          buyer_name: ticket.buyer_name,
          tier_name: ticket.tier_name,
          is_checked_in: true,
          checked_in_at: ticket.checked_in_at,
        },
        message: 'This ticket has already been scanned.',
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from('tickets')
      .update({ is_checked_in: true, checked_in_at: new Date().toISOString() })
      .eq('id', ticket.id)
      .eq('is_checked_in', false)
      .select('ticket_code, buyer_name, tier_name, is_checked_in, checked_in_at')
      .maybeSingle();
    if (updateError) throw updateError;

    if (!updated) {
      const { data: current } = await supabase
        .from('tickets')
        .select('ticket_code, buyer_name, tier_name, is_checked_in, checked_in_at')
        .eq('id', ticket.id)
        .maybeSingle();
      return json({
        result: 'already_used',
        ticket: current ?? undefined,
        message: 'This ticket was just scanned at another gate.',
      });
    }

    return json({ result: 'valid', ticket: updated, message: 'Admit one.' });
  } catch (error) {
    console.error('scan-ticket failed:', error instanceof Error ? error.message : error);
    return json({ error: 'Scanner error. Please try again.' }, 500);
  }
});
