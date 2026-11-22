ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS paystack_reference text,
  ADD COLUMN IF NOT EXISTS amount_paid_ngn integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.finalize_order(p_reference text, p_paystack_ref text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item public.order_items%ROWTYPE;
  v_tier public.ticket_tiers%ROWTYPE;
  v_code text;
  v_i integer;
  v_attempt integer;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('status', 'already_paid', 'order_id', v_order.id);
  END IF;

  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = v_order.id LOOP
    SELECT * INTO v_tier FROM public.ticket_tiers WHERE id = v_item.tier_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TIER_NOT_FOUND';
    END IF;
    IF v_tier.quantity_sold + v_item.quantity > v_tier.quantity_total THEN
      RAISE EXCEPTION 'SOLD_OUT:%', v_tier.name;
    END IF;

    UPDATE public.ticket_tiers
      SET quantity_sold = quantity_sold + v_item.quantity
      WHERE id = v_tier.id;

    FOR v_i IN 1..v_item.quantity LOOP
      v_attempt := 0;
      LOOP
        v_attempt := v_attempt + 1;
        v_code := 'F6-' ||
          lpad((floor(random() * 10000))::int::text, 4, '0') || '-' ||
          chr(65 + floor(random() * 26)::int) ||
          chr(65 + floor(random() * 26)::int);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tickets WHERE ticket_code = v_code);
        IF v_attempt >= 12 THEN
          RAISE EXCEPTION 'TICKET_CODE_COLLISION';
        END IF;
      END LOOP;

      INSERT INTO public.tickets (
        order_id, event_id, tier_id, tier_name, buyer_name, buyer_email,
        ticket_code, paystack_reference, amount_paid_ngn
      ) VALUES (
        v_order.id, v_order.event_id, v_item.tier_id, v_item.tier_name,
        v_order.buyer_name, v_order.buyer_email, v_code,
        COALESCE(p_paystack_ref, v_order.reference), v_item.unit_price_ngn
      );
    END LOOP;
  END LOOP;

  UPDATE public.orders
    SET status = 'paid',
        paid_at = now(),
        paystack_reference = COALESCE(p_paystack_ref, paystack_reference)
    WHERE id = v_order.id;

  RETURN jsonb_build_object('status', 'paid', 'order_id', v_order.id);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_order(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_order(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_order(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order(text, text) TO service_role;

UPDATE public.tickets t
SET paystack_reference = o.paystack_reference,
    amount_paid_ngn = COALESCE(
      (SELECT price_ngn FROM public.ticket_tiers WHERE id = t.tier_id), 0
    )
FROM public.orders o
WHERE t.order_id = o.id;

DROP POLICY IF EXISTS tickets_host_update ON public.tickets;
CREATE POLICY tickets_host_update ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id AND e.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id AND e.host_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS tickets_event_created_idx
  ON public.tickets (event_id, created_at DESC);