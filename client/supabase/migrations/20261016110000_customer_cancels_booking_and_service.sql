-- ============================================================================
-- العميل يلغي حجزه أو طلب خدمته — زيّ «إنها لك» بالظبط
-- ============================================================================
-- الفجوة   : العميل يقدر **يكمّل أو يلغي** طلبه المعلّق في «إنها لك» بس
--            (`cancel_my_order`، ملف 20261015043432 و071231). الحجوزات
--            وطلبات الخدمات مالهاش الطريق ده خالص.
--
--            والنتيجة ظاهرة في البيانات: ستّ حجوزات `pending` من يوم
--            واحد، العميل بدأها وما دفعش، **ومالوش طريقة لا يكمّل ولا
--            يشيل**. وآلية الإلغاء التلقائي بتغطّي `orders` وحدها،
--            فهما بيتراكموا.
--
-- الحل     : نفس نمط `cancel_my_order` حرفيًّا — نمط **مجرَّب وشغّال
--            على الإنتاج** (اتصلّح امبارح واتأكد).
--
-- ── ليه علامة محلية للمعاملة ────────────────────────────────
--
-- حارس الاشتراكات (`guard_course_subscription_fields`) وحارس طلبات
-- الخدمات (`guard_service_order_fields`) **بيرجّعا أي تغيير حالة من
-- العميل في صمت** غير `pending → awaiting_verification`. يعني التحديث
-- «بينجح» والحالة ما بتتغيّرش — **نجاح كاذب**، والشاشة تقول «تم» والطلب
-- زيّ ما هو. (ده بالظبط اللي حصل في «إنها لك» قبل إصلاح امبارح.)
--
-- فالعلامة بتتحط من دالة الإلغاء وحدها، بتعيش جوّه المعاملة بس، وبتسمح
-- بانتقال واحد: `pending` → `cancelled`. والدالة **بتتأكد** إن الحالة
-- بقت ملغية فعلًا قبل ما تقول «تمّ».
--
-- الأثر    : أربع دوال (حارسين + إلغاءين). مفيش بيانات بتتغيّر، ومفيش
--            صلاحية بتتوسّع: العلامة مالهاش أي معنى برّه الدالة،
--            والحارسين لسه بيقفلوا الفلوس والملكية وكل حاجة تانية.
--
-- ⚠️ **المدفوع مايتلغيش من العميل.** `active` (حجز مفعّل) و`paid`
--    (خدمة مدفوعة) و`awaiting_verification` (إيصال مرفوع مستني مراجعة)
--    كلهم برّه — دول بيتلغوا من الإدارة بسبب مسجَّل، لأن فيهم فلوس أو
--    مراجعة جارية.
--
-- التحقق   : تجربة جوّه معاملة بتتلغي آخر الملف.
--
-- الرجوع   : الحارسين من 20261012174147 (النسخة اللي في القاعدة دلوقتي)،
--            و`drop function` للدالتين الجديدتين.
-- ============================================================================


-- ── ١) حارس الاشتراكات: يسمح بإلغاء العميل لحجزه المعلّق ─────
create or replace function public.guard_course_subscription_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.user_id                 := OLD.user_id;
  NEW.package_id              := OLD.package_id;
  NEW.child_id                := OLD.child_id;
  NEW.participant_type        := OLD.participant_type;
  NEW.started_at              := OLD.started_at;
  -- الفلوس والمدرب المعتمد: العميل ما بيلمسهمش.
  NEW.amount                  := OLD.amount;
  NEW.preferred_instructor_id := OLD.preferred_instructor_id;
  -- الإهداء بيتكتب مرة واحدة مع الحجز — جزء من المنفَّذ زي المبلغ.
  NEW.gift_message            := OLD.gift_message;

  -- انتقالان مسموحان للعميل:
  --   ١) «حوّلت» + رقم التحويل.
  --   ٢) إلغاء حجزه هو وهو لسه مادفعش — والعلامة بتتحط من
  --      `cancel_my_booking` وحدها وبتعيش جوّه المعاملة بس.
  IF OLD.status = 'pending' AND NEW.status = 'awaiting_verification' THEN
    NEW.transaction_reference := NEW.transaction_reference;
  ELSIF coalesce(current_setting('app.customer_cancel', true), '') = 'on'
        AND OLD.status = 'pending'
        AND NEW.status = 'cancelled' THEN
    NEW.transaction_reference := OLD.transaction_reference;
  ELSE
    NEW.status                := OLD.status;
    NEW.transaction_reference := OLD.transaction_reference;
  END IF;

  RETURN NEW;
END
$function$;


-- ── ٢) إلغاء العميل لحجزه ───────────────────────────────────
create or replace function public.cancel_my_booking(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner  uuid;
  v_status text;
  v_after  text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  -- ⚠️ `id` هنا نوعه `text` مش `uuid` — المقارنة نصّية.
  select user_id, status into v_owner, v_status
    from course_subscriptions where id::text = p_id for update;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_yours');
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', v_status);
  end if;

  perform set_config('app.customer_cancel', 'on', true);
  update course_subscriptions set status = 'cancelled' where id::text = p_id;
  perform set_config('app.customer_cancel', 'off', true);

  -- التأكد إن الحارس ما رجّعش التغيير في صمت.
  select status into v_after from course_subscriptions where id::text = p_id;
  if v_after <> 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'blocked', 'status', v_after);
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.cancel_my_booking(text) from public, anon;
grant execute on function public.cancel_my_booking(text) to authenticated;


-- ── ٣) حارس طلبات الخدمات: يسمح بإلغاء المشتري لطلبه المعلّق ─
create or replace function public.guard_service_order_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  is_the_provider BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- مقدّم الخدمة المكلَّف: مدرب بالطريقة القديمة، أو مقدّم بالجديدة.
  SELECT EXISTS (
    SELECT 1 FROM instructors i
    WHERE i.id = OLD.instructor_id AND i.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM service_providers sp
    LEFT JOIN instructors i2 ON i2.id = sp.instructor_id
    WHERE sp.id = OLD.provider_id
      AND (sp.user_id = auth.uid() OR i2.user_id = auth.uid())
  ) INTO is_the_provider;

  IF TG_OP = 'INSERT' THEN
    NEW.status             := 'pending';
    NEW.instructor_earning := NULL;
    NEW.delivered_at       := NULL;
    NEW.completed_at       := NULL;
    NEW.due_at             := NULL;
    NEW.due_note           := NULL;
    -- الدفع ما بيتسجّلش وقت إنشاء الطلب.
    NEW.payment_method      := NULL;
    NEW.payment_receipt_url := NULL;
    RETURN NEW;
  END IF;

  IF is_the_provider THEN
    -- مقدّم الخدمة: يبدأ (مدفوع ← قيد التنفيذ)، ويسلّم.
    IF NOT (
         (OLD.status = 'paid'                       AND NEW.status = 'in_progress')
      OR (OLD.status IN ('paid', 'in_progress')     AND NEW.status = 'delivered')
    ) THEN
      NEW.status := OLD.status;
    END IF;
    NEW.transaction_reference := OLD.transaction_reference;
    NEW.payment_method        := OLD.payment_method;
    NEW.payment_receipt_url   := OLD.payment_receipt_url;
  ELSE
    -- المشتري: «حوّلت»، و«استلمت وأأكّد»، **وإلغاء طلبه قبل الدفع**.
    IF OLD.status = 'pending' AND NEW.status = 'awaiting_verification' THEN
      NULL;
    ELSIF OLD.status = 'delivered' AND NEW.status = 'completed' THEN
      NEW.payment_method        := OLD.payment_method;
      NEW.payment_receipt_url   := OLD.payment_receipt_url;
    ELSIF coalesce(current_setting('app.customer_cancel', true), '') = 'on'
          AND OLD.status = 'pending'
          AND NEW.status = 'cancelled' THEN
      NEW.transaction_reference := OLD.transaction_reference;
      NEW.payment_method        := OLD.payment_method;
      NEW.payment_receipt_url   := OLD.payment_receipt_url;
    ELSE
      NEW.status                := OLD.status;
      NEW.transaction_reference := OLD.transaction_reference;
      NEW.payment_method        := OLD.payment_method;
      NEW.payment_receipt_url   := OLD.payment_receipt_url;
    END IF;
  END IF;

  -- الفلوس والأطراف والمهلة والرقم المرجعي: محدش غير الإدارة.
  NEW.id                    := OLD.id;
  NEW.buyer_profile_id      := OLD.buyer_profile_id;
  NEW.instructor_id         := OLD.instructor_id;
  NEW.provider_id           := OLD.provider_id;
  NEW.amount                := OLD.amount;
  NEW.instructor_earning    := OLD.instructor_earning;
  NEW.package_id            := OLD.package_id;
  NEW.standalone_service_id := OLD.standalone_service_id;
  NEW.created_at            := OLD.created_at;
  NEW.due_at                := OLD.due_at;
  NEW.due_note              := OLD.due_note;
  NEW.payment_reference     := OLD.payment_reference;

  RETURN NEW;
END
$function$;


-- ── ٤) إلغاء المشتري لطلب خدمته ─────────────────────────────
create or replace function public.cancel_my_service_order(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner  uuid;
  v_status text;
  v_after  text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select buyer_profile_id, status::text into v_owner, v_status
    from service_orders where id::text = p_id for update;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_yours');
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', v_status);
  end if;

  perform set_config('app.customer_cancel', 'on', true);
  update service_orders set status = 'cancelled' where id::text = p_id;
  perform set_config('app.customer_cancel', 'off', true);

  select status::text into v_after from service_orders where id::text = p_id;
  if v_after <> 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'blocked', 'status', v_after);
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.cancel_my_service_order(text) from public, anon;
grant execute on function public.cancel_my_service_order(text) to authenticated;


-- ============================================================================
-- تجربة بعد التشغيل — جوّه معاملة بتتلغي، مفيش صف بيتغيّر
-- ============================================================================
--   begin;
--   do $probe$
--   declare v_id text; v_user uuid; r jsonb; v_after text;
--   begin
--     select id::text, user_id into v_id, v_user
--       from course_subscriptions where status = 'pending'
--       order by created_at desc limit 1;
--     if v_id is null then raise exception 'RESULT: مفيش حجز معلّق'; end if;
--
--     -- ننتحل شخصية صاحب الحجز: من غير كده الحارس بيعدّي بلا فحص
--     -- والنتيجة بتبقى مضلّلة.
--     perform set_config('request.jwt.claims',
--       json_build_object('sub', v_user::text, 'role','authenticated')::text, true);
--     perform set_config('role', 'authenticated', true);
--
--     r := public.cancel_my_booking(v_id);
--     select status into v_after from course_subscriptions where id::text = v_id;
--     raise exception 'RESULT: النتيجة=% | الحالة بقت=%', r, v_after;
--   end $probe$;
--   rollback;
--
-- المتوقع: `ok: true` والحالة `cancelled`.
-- ============================================================================
