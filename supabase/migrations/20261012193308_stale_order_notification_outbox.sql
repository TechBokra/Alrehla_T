-- ============================================================
-- ٢١ — إلغاء الطلبات القديمة وحفظ إشعاراتها لإعادة المحاولة
-- Applied after the repository's historical schema migrations.
-- ============================================================


CREATE TABLE public.stale_order_notification_outbox (
  order_id uuid PRIMARY KEY,
  recipient_profile_id text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_error text
);

CREATE INDEX stale_order_notification_outbox_pending_idx
  ON public.stale_order_notification_outbox (last_attempt_at NULLS FIRST, created_at, order_id)
  WHERE delivered_at IS NULL;

ALTER TABLE public.stale_order_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stale_order_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stale_order_notification_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_stale_pending_orders(p_days integer, p_now timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cancelled integer;
BEGIN
  IF p_days IS NULL OR p_days < 0 OR p_days > 60 THEN
    RAISE EXCEPTION 'p_days must be between 0 and 60';
  END IF;
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'p_now is required';
  END IF;
  IF p_days = 0 THEN
    RETURN 0;
  END IF;

  WITH changed AS (
    UPDATE public.orders AS o
       SET status = 'cancelled',
           admin_notes = format('اتلغى تلقائيًا: مفيش إيصال دفع خلال %s أيام.', p_days),
           updated_at = p_now
     WHERE o.status = 'pending'
       AND o.payment_receipt_url IS NULL
       AND o.created_at < p_now - make_interval(days => p_days)
    RETURNING o.id, o.user_id, o.payment_reference
  ), queued AS (
    INSERT INTO public.stale_order_notification_outbox (
      order_id, recipient_profile_id, title, message, link
    )
    SELECT
      changed.id,
      changed.user_id::text,
      'طلبك اتلغى',
      format(
        'الطلب %s اتلغى لأنه مااتدفعش خلال %s أيام. لو لسه عايزه، تقدر تطلبه تاني في أي وقت.',
        coalesce(changed.payment_reference, ''),
        p_days
      ),
      '/account/orders/enha-lak'
    FROM changed
    ON CONFLICT (order_id) DO NOTHING
    RETURNING order_id
  )
  SELECT count(*)::integer INTO v_cancelled FROM changed;

  RETURN v_cancelled;
END
$function$;

CREATE OR REPLACE FUNCTION public.deliver_stale_order_notifications(p_limit integer DEFAULT 1000)
RETURNS TABLE(delivered_count integer, failed_count integer, pending_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification public.stale_order_notification_outbox%ROWTYPE;
  v_delivered integer := 0;
  v_failed integer := 0;
  v_pending integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 1000';
  END IF;

  FOR v_notification IN
    SELECT *
      FROM public.stale_order_notification_outbox
     WHERE delivered_at IS NULL
     ORDER BY last_attempt_at NULLS FIRST, created_at, order_id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.stale_order_notification_outbox
       SET attempt_count = attempt_count + 1,
           last_attempt_at = clock_timestamp()
     WHERE order_id = v_notification.order_id;

    -- Each notice is isolated so a broken recipient or row does not block
    -- other notices. The savepoint rolls back only this attempted insert.
    BEGIN
      INSERT INTO public.notifications (
        id, recipient_profile_id, title, message, link
      )
      VALUES (
        'stale-order-cancelled:' || v_notification.order_id::text,
        v_notification.recipient_profile_id,
        v_notification.title,
        v_notification.message,
        v_notification.link
      )
      ON CONFLICT (id) DO NOTHING;

      UPDATE public.stale_order_notification_outbox
         SET delivered_at = clock_timestamp(), last_error = NULL
       WHERE order_id = v_notification.order_id;
      v_delivered := v_delivered + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.stale_order_notification_outbox
         SET last_error = left(SQLERRM, 2000)
       WHERE order_id = v_notification.order_id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  SELECT count(*)::integer INTO v_pending
    FROM public.stale_order_notification_outbox
   WHERE delivered_at IS NULL;

  RETURN QUERY SELECT v_delivered, v_failed, v_pending;
END
$function$;

REVOKE ALL ON FUNCTION public.cancel_stale_pending_orders(integer, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_stale_pending_orders(integer, timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.deliver_stale_order_notifications(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deliver_stale_order_notifications(integer) TO service_role;

