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
        order_id, event_id, tier_id, tier_name, buyer_name, buyer_email, ticket_code
      ) VALUES (
        v_order.id, v_order.event_id, v_item.tier_id, v_item.tier_name,
        v_order.buyer_name, v_order.buyer_email, v_code
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

DO $$
DECLARE
  v_ticket RECORD;
  v_code text;
  v_attempt integer;
BEGIN
  FOR v_ticket IN SELECT id FROM public.tickets WHERE ticket_code LIKE 'TIX-%' LOOP
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

    UPDATE public.tickets SET ticket_code = v_code WHERE id = v_ticket.id;
  END LOOP;
END;
$$;

UPDATE public.orders
SET reference = 'F6-' || (extract(epoch from created_at) * 1000)::bigint::text || '-' ||
  lpad((floor(random() * 1000000))::int::text, 6, '0')
WHERE reference LIKE 'NTX-%';