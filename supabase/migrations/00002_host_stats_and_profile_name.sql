CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    'user'::public.user_role
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.event_stats(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
BEGIN
  SELECT host_id INTO v_host FROM public.events WHERE id = p_event_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF v_host <> auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN jsonb_build_object(
    'tickets_sold', COALESCE((SELECT count(*) FROM public.tickets t WHERE t.event_id = p_event_id), 0),
    'checked_in', COALESCE((SELECT count(*) FROM public.tickets t WHERE t.event_id = p_event_id AND t.is_checked_in), 0),
    'orders_paid', COALESCE((SELECT count(*) FROM public.orders o WHERE o.event_id = p_event_id AND o.status = 'paid'), 0),
    'gross_revenue_ngn', COALESCE((SELECT sum(o.total_ngn) FROM public.orders o WHERE o.event_id = p_event_id AND o.status = 'paid'), 0),
    'ticket_revenue_ngn', COALESCE((SELECT sum(o.subtotal_ngn) FROM public.orders o WHERE o.event_id = p_event_id AND o.status = 'paid'), 0),
    'fees_ngn', COALESCE((SELECT sum(o.service_fee_ngn) FROM public.orders o WHERE o.event_id = p_event_id AND o.status = 'paid'), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.event_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.event_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.event_stats(uuid) TO authenticated;

CREATE FUNCTION public.host_event_summaries()
RETURNS TABLE (event_id uuid, tickets_sold bigint, checked_in bigint, revenue_ngn bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id AS event_id,
    COALESCE((SELECT count(*) FROM public.tickets t WHERE t.event_id = e.id), 0) AS tickets_sold,
    COALESCE((SELECT count(*) FROM public.tickets t WHERE t.event_id = e.id AND t.is_checked_in), 0) AS checked_in,
    COALESCE((SELECT sum(o.total_ngn) FROM public.orders o WHERE o.event_id = e.id AND o.status = 'paid'), 0) AS revenue_ngn
  FROM public.events e
  WHERE e.host_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.host_event_summaries() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.host_event_summaries() FROM anon;
GRANT EXECUTE ON FUNCTION public.host_event_summaries() TO authenticated;