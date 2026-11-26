-- ============================================================
-- Host payouts
--
-- All ticket money lands in the platform's Paystack account. Hosts add a bank
-- account, request a payout, and an admin pays them out and marks the request done.
--
--   host share  = sum of orders.subtotal_ngn (ticket sales). The flat service fee
--                 (orders.service_fee_ngn) stays with the platform.
--   withdrawable = host share from events that have STARTED (and are not cancelled),
--                  minus payouts already paid or still pending.
--   Holding money until the event starts protects against chargebacks / fake events.
--   To pay out immediately instead, delete the "e.event_date <= now()" condition in
--   host_payout_balance().
-- ============================================================

-- Hosts should see their own share (ticket sales), not the buyer's total incl. service fee.
CREATE OR REPLACE FUNCTION public.host_event_summaries()
RETURNS TABLE (event_id uuid, tickets_sold bigint, checked_in bigint, revenue_ngn bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id AS event_id,
    COALESCE((SELECT count(*) FROM public.tickets t WHERE t.event_id = e.id), 0) AS tickets_sold,
    COALESCE((SELECT count(*) FROM public.tickets t WHERE t.event_id = e.id AND t.is_checked_in), 0) AS checked_in,
    COALESCE((SELECT sum(o.subtotal_ngn) FROM public.orders o WHERE o.event_id = e.id AND o.status = 'paid'), 0) AS revenue_ngn
  FROM public.events e
  WHERE e.host_id = auth.uid();
$$;

-- ---------- tables ----------
CREATE TABLE public.payout_accounts (
  host_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL CHECK (account_number ~ '^[0-9]{10}$'),
  account_name text NOT NULL CHECK (char_length(account_name) BETWEEN 3 AND 100),
  name_verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_ngn integer NOT NULL CHECK (amount_ngn > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  -- bank details are copied at request time so later edits can't redirect a pending payout
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  name_verified boolean NOT NULL DEFAULT false,
  account_updated_at timestamptz NOT NULL,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES public.profiles(id)
);

-- at most one open request per host
CREATE UNIQUE INDEX payout_requests_one_pending_per_host
  ON public.payout_requests (host_id) WHERE status = 'pending';
CREATE INDEX payout_requests_host_idx ON public.payout_requests (host_id, created_at DESC);
CREATE INDEX payout_requests_status_idx ON public.payout_requests (status, created_at);

-- ---------- RLS: read-only from the client; all writes go through the functions below ----------
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout_accounts_self_read" ON public.payout_accounts
  FOR SELECT TO authenticated USING (host_id = auth.uid());

CREATE POLICY "payout_requests_self_read" ON public.payout_requests
  FOR SELECT TO authenticated USING (host_id = auth.uid());

-- ---------- balance ----------
CREATE FUNCTION public.host_payout_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_earned bigint;
  v_released bigint;
  v_paid bigint;
  v_pending bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT
    COALESCE(sum(o.subtotal_ngn), 0),
    COALESCE(sum(o.subtotal_ngn) FILTER (WHERE e.event_date <= now() AND e.status <> 'cancelled'), 0)
  INTO v_earned, v_released
  FROM public.orders o
  JOIN public.events e ON e.id = o.event_id
  WHERE e.host_id = v_uid AND o.status = 'paid';

  SELECT
    COALESCE(sum(amount_ngn) FILTER (WHERE status = 'paid'), 0),
    COALESCE(sum(amount_ngn) FILTER (WHERE status = 'pending'), 0)
  INTO v_paid, v_pending
  FROM public.payout_requests
  WHERE host_id = v_uid;

  RETURN jsonb_build_object(
    'earned_ngn', v_earned,
    'held_ngn', v_earned - v_released,
    'pending_ngn', v_pending,
    'paid_out_ngn', v_paid,
    'available_ngn', GREATEST(v_released - v_paid - v_pending, 0),
    'min_payout_ngn', 1000
  );
END;
$$;

-- ---------- host: request a payout ----------
CREATE FUNCTION public.request_payout(p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_acct public.payout_accounts%ROWTYPE;
  v_bal jsonb;
  v_row public.payout_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- serialise requests per host so two taps can't both pass the balance check
  PERFORM pg_advisory_xact_lock(hashtextextended('payout:' || v_uid::text, 0));

  SELECT * INTO v_acct FROM public.payout_accounts WHERE host_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_BANK_ACCOUNT';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payout_requests WHERE host_id = v_uid AND status = 'pending') THEN
    RAISE EXCEPTION 'REQUEST_PENDING';
  END IF;

  v_bal := public.host_payout_balance();

  IF p_amount IS NULL OR p_amount < (v_bal->>'min_payout_ngn')::integer THEN
    RAISE EXCEPTION 'BELOW_MINIMUM';
  END IF;
  IF p_amount > (v_bal->>'available_ngn')::bigint THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  INSERT INTO public.payout_requests (
    host_id, amount_ngn, bank_code, bank_name, account_number, account_name,
    name_verified, account_updated_at
  ) VALUES (
    v_uid, p_amount, v_acct.bank_code, v_acct.bank_name, v_acct.account_number,
    v_acct.account_name, v_acct.name_verified, v_acct.updated_at
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

-- ---------- admin: list / resolve ----------
CREATE FUNCTION public.admin_list_payouts(p_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  host_id uuid,
  host_name text,
  host_email text,
  amount_ngn integer,
  status text,
  bank_name text,
  account_number text,
  account_name text,
  name_verified boolean,
  account_updated_at timestamptz,
  admin_note text,
  created_at timestamptz,
  processed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.host_id, p.display_name, p.email, r.amount_ngn, r.status,
    r.bank_name, r.account_number, r.account_name, r.name_verified,
    r.account_updated_at, r.admin_note, r.created_at, r.processed_at
  FROM public.payout_requests r
  JOIN public.profiles p ON p.id = r.host_id
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY (r.status = 'pending') DESC, r.created_at DESC
  LIMIT 200;
END;
$$;

CREATE FUNCTION public.admin_resolve_payout(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.payout_requests%ROWTYPE;
BEGIN
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_status NOT IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;
  IF p_status = 'rejected' AND COALESCE(btrim(p_note), '') = '' THEN
    RAISE EXCEPTION 'NOTE_REQUIRED';
  END IF;

  UPDATE public.payout_requests
  SET status = p_status,
      admin_note = NULLIF(btrim(p_note), ''),
      processed_at = now(),
      processed_by = auth.uid()
  WHERE id = p_id AND status = 'pending'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_PENDING';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

-- ---------- grants ----------
REVOKE ALL ON FUNCTION public.host_payout_balance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_payout(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_payouts(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_payout(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_payout_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_payouts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_payout(uuid, text, text) TO authenticated;
