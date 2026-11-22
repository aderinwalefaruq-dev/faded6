import { json, preflight } from '../_shared/cors.ts';

const KEY_PATTERN = /^pk_(test|live)_[A-Za-z0-9]+$/;

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const publicKey = (Deno.env.get('PAYSTACK_PUBLIC_KEY') ?? '').trim();
  const secretKey = (Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').trim();

  const mode = publicKey.startsWith('pk_live_')
    ? 'live'
    : publicKey.startsWith('pk_test_')
      ? 'test'
      : 'unknown';

  return json({
    public_key: publicKey,
    configured: KEY_PATTERN.test(publicKey) && secretKey.length > 0,
    mode,
  });
});
