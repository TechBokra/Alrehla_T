-- ============================================================================
-- إلغاء العميل يعدّي من حارس الطلب (تصحيح 20261015043432)
-- ============================================================================
-- المشكلة : `cancel_my_order` كانت بتحدّث الحالة، لكن `guard_order_fields`
--           بيرجّع `NEW.status := OLD.status` لأي انتقال غير
--           pending → awaiting_verification. فالتحديث «بينجح» والحالة ما
--           بتتغيّرش، والواجهة تقول «تم» والطلب زي ما هو — نجاح كاذب.
--
-- الحل    : علامة محلية للمعاملة (`app.customer_cancel`) بتتحط من
--           `cancel_my_order` وحدها، والحارس بيسمح بيها بانتقال واحد بس:
--           pending/failed → cancelled، ومعاه سبب الإلغاء في `admin_notes`
--           (اللي حارس الانتقالات بيطلبه).
--           والدالة بقت **تتأكد** إن الحالة بقت `cancelled` فعلًا وترجّع
--           خطأ لو الحارس رفض.
--
-- الأثر   : الدالتين بس. مفيش بيانات بتتغيّر ومفيش صلاحية بتتوسّع:
--           العلامة مالهاش أي معنى برّه الدالة، والحارس لسه بيقفل الفلوس
--           والملكية ومراجع الدفع والشحن زي ما هو.
--
-- التحقق  : اتجرّب على الإنتاج جوّه معاملة اتلغت، بانتحال شخصية العميل:
--             طلب مدفوع     → not_cancellable، والحالة فضلت paid
--             طلب حد تاني   → not_your_order
--             طلبي المعلّق  → اتلغى فعلًا
--
-- الرجوع  : رجّع `guard_order_fields` من 20261015060000،
--           و`cancel_my_order` من 20261015043432.
-- ============================================================================

create or replace function public.guard_order_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- الاستثناءان الوحيدان للعميل:
  --   ١) «حوّلت» + الإيصال.
  --   ٢) إلغاء طلبه هو وهو لسه مادفعش — والعلامة بتتحط من
  --      `cancel_my_order` وحدها وبتعيش جوه المعاملة بس.
  IF (OLD.status = 'pending' AND NEW.status = 'awaiting_verification')
     OR (coalesce(current_setting('app.customer_cancel', true), '') = 'on'
         AND OLD.status IN ('pending', 'failed')
         AND NEW.status = 'cancelled') THEN
    NULL;
  ELSE
    NEW.status              := OLD.status;
    NEW.payment_method      := OLD.payment_method;
    NEW.payment_receipt_url := OLD.payment_receipt_url;
  END IF;

  NEW.id                    := OLD.id;
  NEW.user_id               := OLD.user_id;
  NEW.total_amount          := OLD.total_amount;
  NEW.shipping_fee          := OLD.shipping_fee;
  NEW.created_at            := OLD.created_at;
  NEW.payment_reference     := OLD.payment_reference;
  NEW.transaction_reference := OLD.transaction_reference;
  NEW.country_code          := OLD.country_code;
  NEW.payment_provider      := OLD.payment_provider;
  NEW.payment_session_id    := OLD.payment_session_id;
  NEW.payment_intent_id     := OLD.payment_intent_id;
  NEW.paid_at               := OLD.paid_at;
  NEW.shipped_at            := OLD.shipped_at;
  NEW.delivered_at          := OLD.delivered_at;
  NEW.tracking_reference    := OLD.tracking_reference;
  -- سبب الإلغاء لازم يتكتب مع الإلغاء؛ وغير كده الملاحظات للإدارة وحدها.
  IF coalesce(current_setting('app.customer_cancel', true), '') <> 'on' THEN
    NEW.admin_notes         := OLD.admin_notes;
  END IF;
  NEW.electronic_sent_at    := OLD.electronic_sent_at;
  NEW.box_plan_id           := OLD.box_plan_id;
  NEW.box_details           := OLD.box_details;

  RETURN NEW;
END
$function$;

create or replace function public.cancel_my_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order record;
  v_status text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v_order.user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_your_order');
  end if;
  if v_order.status not in ('pending', 'failed') then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', v_order.status);
  end if;

  perform set_config('app.customer_cancel', 'on', true);
  update orders
     set status      = 'cancelled',
         admin_notes = 'ألغاه العميل من حسابه.',
         updated_at  = now()
   where id = p_order_id;
  perform set_config('app.customer_cancel', 'off', true);

  -- ⚠️ **التأكد إن الإلغاء حصل فعلًا.** الحارس بيصحّح الصفوف في صمت بدل
  --    ما يرمي، فالتحديث ممكن «ينجح» والحالة ما تتغيّرش.
  select status::text into v_status from orders where id = p_order_id;
  if v_status <> 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'blocked', 'status', v_status);
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;
