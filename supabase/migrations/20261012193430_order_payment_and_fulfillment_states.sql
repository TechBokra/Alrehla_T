-- ============================================================
-- ٢٢ — فرض إثبات الدفع وانتقالات حالة الطلب
-- Applies through Supabase CLI after the stale-order notification migration.
-- ============================================================


CREATE OR REPLACE FUNCTION public.validate_order_state_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_transition_allowed boolean := false;
  v_payment_proof_valid boolean := false;
  v_has_electronic_item boolean := false;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_transition_allowed := CASE OLD.status
      WHEN 'pending' THEN
        NEW.status IN ('awaiting_verification', 'cancelled')
      WHEN 'awaiting_verification' THEN
        NEW.status IN ('paid', 'cancelled')
      WHEN 'failed' THEN
        NEW.status = 'cancelled'
      WHEN 'paid' THEN
        NEW.status IN ('preparing', 'shipped', 'cancelled')
      WHEN 'preparing' THEN
        NEW.status IN ('shipped', 'cancelled')
      WHEN 'shipped' THEN
        NEW.status IN ('delivered', 'cancelled')
      ELSE false
    END;

    IF NOT coalesce(v_transition_allowed, false) THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- A submitted payment must include a supported method and a receipt from
  -- our private receipt folder, or a legacy Cloudinary receipt URL.
  IF OLD.status = 'pending' AND NEW.status = 'awaiting_verification' THEN
    v_payment_proof_valid :=
      NEW.payment_method IN ('instapay', 'vodafone_cash')
      AND nullif(btrim(NEW.payment_receipt_url), '') IS NOT NULL
      AND (
        (
          NEW.payment_receipt_url ~ '^private:[A-Za-z0-9]{2,5}:alrehla/private/receipts/.+$'
          AND position('..' IN NEW.payment_receipt_url) = 0
        )
        OR NEW.payment_receipt_url ~ '^https://res\.cloudinary\.com/[^/]+/image/upload/'
      );

    IF NOT coalesce(v_payment_proof_valid, false) THEN
      RAISE EXCEPTION 'A supported payment method and valid receipt are required before payment review'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Payment can only be confirmed from a submitted proof. The same proof
  -- must remain attached while the order is being fulfilled.
  IF NEW.status IN ('paid', 'preparing', 'shipped', 'delivered')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_payment_proof_valid :=
      NEW.payment_method IN ('instapay', 'vodafone_cash')
      AND nullif(btrim(NEW.payment_receipt_url), '') IS NOT NULL
      AND (
        (
          NEW.payment_receipt_url ~ '^private:[A-Za-z0-9]{2,5}:alrehla/private/receipts/.+$'
          AND position('..' IN NEW.payment_receipt_url) = 0
        )
        OR NEW.payment_receipt_url ~ '^https://res\.cloudinary\.com/[^/]+/image/upload/'
      );

    IF NOT coalesce(v_payment_proof_valid, false) THEN
      RAISE EXCEPTION 'Valid payment proof is required before confirming or fulfilling an order'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF OLD.status IN ('paid', 'preparing', 'shipped', 'delivered')
     AND (
       NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.payment_receipt_url IS DISTINCT FROM OLD.payment_receipt_url
     ) THEN
    RAISE EXCEPTION 'Payment proof cannot be changed after payment is confirmed'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM 'cancelled'
     AND nullif(btrim(NEW.admin_notes), '') IS NULL THEN
    RAISE EXCEPTION 'A cancellation reason is required'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'shipped' AND NEW.shipped_at IS NULL THEN
    RAISE EXCEPTION 'A shipped order must have a shipped timestamp'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'delivered'
     AND (NEW.shipped_at IS NULL OR NEW.delivered_at IS NULL) THEN
    RAISE EXCEPTION 'A delivered order must have shipped and delivered timestamps'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.electronic_sent_at IS NOT NULL
     AND NEW.electronic_sent_at IS DISTINCT FROM OLD.electronic_sent_at THEN
    RAISE EXCEPTION 'Electronic delivery confirmation cannot be changed after it is recorded'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.electronic_sent_at IS NULL AND NEW.electronic_sent_at IS NOT NULL THEN
    IF OLD.status NOT IN ('paid', 'preparing', 'shipped', 'delivered') THEN
      RAISE EXCEPTION 'Electronic delivery can only be recorded for a paid order'
        USING ERRCODE = '23514';
    END IF;

    IF nullif(btrim(NEW.delivery_email), '') IS NULL THEN
      RAISE EXCEPTION 'A delivery email is required for electronic delivery'
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1
        FROM public.order_items AS item
       WHERE item.order_id = OLD.id
         AND item.format IN ('electronic', 'both')
    ) INTO v_has_electronic_item;

    IF NOT v_has_electronic_item THEN
      RAISE EXCEPTION 'Only an order with an electronic item can be marked as sent'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.validate_order_state_transition() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_order_state_transition() TO authenticated, service_role;

DROP TRIGGER IF EXISTS validate_order_state_transition_trg ON public.orders;
CREATE TRIGGER validate_order_state_transition_trg
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_state_transition();

