DO $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  FOR v_order IN
    SELECT id FROM public.orders
    WHERE buyer_email IN ('audit@example.com', 'fraud@example.com')
  LOOP
    FOR v_item IN SELECT tier_id, quantity FROM public.order_items WHERE order_id = v_order.id LOOP
      UPDATE public.ticket_tiers
        SET quantity_sold = GREATEST(quantity_sold - v_item.quantity, 0)
        WHERE id = v_item.tier_id;
    END LOOP;
    DELETE FROM public.tickets WHERE order_id = v_order.id;
    DELETE FROM public.order_items WHERE order_id = v_order.id;
    DELETE FROM public.orders WHERE id = v_order.id;
  END LOOP;
END;
$$;