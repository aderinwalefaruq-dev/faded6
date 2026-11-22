import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { loadOrderBundle } from '../_shared/orders.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const reference = String(body?.reference ?? '').trim();
    if (!reference) return json({ error: 'Missing order reference' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const bundle = await loadOrderBundle(supabase, reference);
    if (!bundle) return json({ error: 'Order not found' }, 404);

    return json(bundle);
  } catch (error) {
    console.error('get-order failed:', error instanceof Error ? error.message : error);
    return json({ error: 'Could not load this order' }, 500);
  }
});
