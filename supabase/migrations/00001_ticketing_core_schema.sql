-- ============================================================
-- NaijaTix core schema
-- ============================================================

CREATE TYPE public.user_role AS ENUM ('user', 'admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  display_name text,
  role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, role)
  VALUES (NEW.id, NEW.email, NEW.phone, 'user'::public.user_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE FUNCTION public.get_user_role(uid uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;

-- ============================================================
-- events
-- ============================================================
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  event_date timestamptz NOT NULL,
  venue text NOT NULL,
  banner_url text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_host_id_idx ON public.events (host_id);
CREATE INDEX events_event_date_idx ON public.events (event_date);

-- ============================================================
-- ticket_tiers
-- ============================================================
CREATE TABLE public.ticket_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_ngn integer NOT NULL DEFAULT 0 CHECK (price_ngn >= 0),
  quantity_total integer NOT NULL CHECK (quantity_total >= 0),
  quantity_sold integer NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ticket_tiers_event_id_idx ON public.ticket_tiers (event_id);

-- ============================================================
-- orders
-- ============================================================
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reference text NOT NULL UNIQUE,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  subtotal_ngn integer NOT NULL DEFAULT 0,
  service_fee_ngn integer NOT NULL DEFAULT 0,
  total_ngn integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  paystack_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX orders_event_id_idx ON public.orders (event_id);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.ticket_tiers(id) ON DELETE RESTRICT,
  tier_name text NOT NULL,
  unit_price_ngn integer NOT NULL DEFAULT 0,
  quantity integer NOT NULL CHECK (quantity > 0)
);

CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);

-- ============================================================
-- tickets
-- ============================================================
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.ticket_tiers(id) ON DELETE RESTRICT,
  tier_name text NOT NULL,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  ticket_code text NOT NULL UNIQUE,
  is_checked_in boolean NOT NULL DEFAULT false,
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tickets_event_id_idx ON public.tickets (event_id);
CREATE INDEX tickets_order_id_idx ON public.tickets (order_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role IS NOT DISTINCT FROM public.get_user_role(auth.uid()));

-- events
CREATE POLICY "events_public_read" ON public.events
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "events_host_read" ON public.events
  FOR SELECT TO authenticated
  USING (host_id = auth.uid());

CREATE POLICY "events_host_insert" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "events_host_update" ON public.events
  FOR UPDATE TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "events_host_delete" ON public.events
  FOR DELETE TO authenticated
  USING (host_id = auth.uid());

-- ticket_tiers
CREATE POLICY "tiers_public_read" ON public.ticket_tiers
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = ticket_tiers.event_id AND e.status = 'published'
  ));

CREATE POLICY "tiers_host_read" ON public.ticket_tiers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = ticket_tiers.event_id AND e.host_id = auth.uid()
  ));

CREATE POLICY "tiers_host_insert" ON public.ticket_tiers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = ticket_tiers.event_id AND e.host_id = auth.uid()
  ));

CREATE POLICY "tiers_host_update" ON public.ticket_tiers
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = ticket_tiers.event_id AND e.host_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = ticket_tiers.event_id AND e.host_id = auth.uid()
  ));

CREATE POLICY "tiers_host_delete" ON public.ticket_tiers
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = ticket_tiers.event_id AND e.host_id = auth.uid()
  ));

-- orders (host read only; writes happen through edge functions with service role)
CREATE POLICY "orders_host_read" ON public.orders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = orders.event_id AND e.host_id = auth.uid()
  ));

CREATE POLICY "order_items_host_read" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.events e ON e.id = o.event_id
    WHERE o.id = order_items.order_id AND e.host_id = auth.uid()
  ));

CREATE POLICY "tickets_host_read" ON public.tickets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = tickets.event_id AND e.host_id = auth.uid()
  ));

-- ============================================================
-- finalize_order: atomic inventory decrement + ticket issuance
-- ============================================================
CREATE FUNCTION public.finalize_order(p_reference text, p_paystack_ref text DEFAULT NULL)
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
      v_code := 'TIX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
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

-- ============================================================
-- Storage bucket for event banners
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-banners', 'event-banners', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

CREATE POLICY "banners_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'event-banners');

CREATE POLICY "banners_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-banners' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "banners_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'event-banners' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "banners_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'event-banners' AND (storage.foldername(name))[1] = auth.uid()::text);