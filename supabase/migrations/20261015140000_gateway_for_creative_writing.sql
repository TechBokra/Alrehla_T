-- ============================================================================
-- بوابة الدفع لـ«بداية الرحلة» (الخدمات والحجوزات)
-- ============================================================================
-- الغرض   : XPay كانت مربوطة بجدول `orders` وحده — يعني «إنها لك». و«بداية
--           الرحلة» بتمشي على `service_orders` و`course_subscriptions`،
--           والجدولين مافيهمش أعمدة الدفع الإلكتروني أصلًا. فالعميل هناك
--           مالوش غير التحويل اليدوي.
--
-- ── أربع عقبات حقيقية اتكشفت قبل كتابة الملف ده ─────────────
--
--   ١) `payment_events.order_id` عليه مفتاح أجنبي على `orders` وحده.
--      يعني أول محاولة تسجيل دفعة خدمة كانت هتترفض — ومعاها **آلية
--      منع التكرار كلها**، واللي بتمنع الدفعة تتحسب مرتين.
--      الحل: `source_kind` + `source_id` جداد، و`order_id` بيفضل
--      للطلبات وحدها (وهو nullable أصلًا).
--
--   ٢) `payment_method` مقفول على `instapay`/`vodafone_cash` في
--      الجدولين — فدفعة بالبطاقة كانت هتترفض بقيد.
--
--   ٣) مفيش حالة `failed` في أي منهم: `course_subscriptions` بيوصل
--      `active` و`service_orders` بيوصل `paid`. فالمحاولة الفاشلة
--      بترجّع الحالة `pending` بدل ما تدوّر على حالة مش موجودة.
--
--   ٤) 🔴 **`attach_payment_session` ماكانتش بتحفظ حاجة أصلًا.**
--      `guard_order_fields` بيرجّع `payment_provider` و
--      `payment_session_id` لقيمتهم القديمة لأي نداء من العميل،
--      والدالة كانت بترجّع `ok:true` على طول — نجاح كاذب. الدفع كان
--      شغّال لأن الويبهوك (بمفتاح الخدمة، و`auth.uid()` فاضية عنده)
--      بيكتب القيم بعدين. بس رقم الجلسة ماكانش بيتخزن ولا مرة،
--      فطلب اتبدأ دفعه وماكملش ماكانش ليه أثر يتتبع بيه.
--      الحل: علامة محلية للمعاملة (`app.gateway_attach`) زي اللي
--      اتعملت لإلغاء العميل، **ومعاها تأكيد إن الكتابة حصلت فعلًا**.
--
-- ⚠️ **واللي الملف ده مابيعملوش عن قصد**: مابيحوّلش الحجز لـ«نشط»
--    بمفرده. تأكيد الدفع اليدوي بيعمل حاجة تانية أهم — **بيولّد
--    الجلسات** (`createSessionsForSubscription`) وبيبعت الإشعارات،
--    والخدمات بتاخد `due_at` (مهلة مقدّم الخدمة). ده شغل تطبيق مش
--    شغل قاعدة. فالدالة هنا بتسجّل الدفعة وبتقفل التكرار وبتتحقق من
--    المبلغ، **والويبهوك هو اللي بيكمّل** بنفس الكود اللي الإدارة
--    بتناديه. من غير كده العميل بيدفع بالبطاقة وماتظهرش عنده ولا جلسة.
--
-- الأثر   : أعمدة جديدة (كلها بقيم افتراضية آمنة)، قيدين بيتوسّعوا،
--           وتلات دوال. مفيش بيانات بتتغيّر، ومسار «إنها لك» الشغّال
--           مابيتلمسش غير بإصلاح العقبة (٤).
--
-- التحقق  : آخر الملف فيه استعلام قراءة بس.
--
-- الرجوع  : مكتوب آخر الملف.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- ١) أعمدة الدفع الإلكتروني على الجدولين
-- ─────────────────────────────────────────────────────────────────────────
alter table public.service_orders
  add column if not exists payment_provider   text not null default 'manual',
  add column if not exists payment_session_id text,
  add column if not exists payment_intent_id  text,
  add column if not exists paid_at            timestamptz;

alter table public.course_subscriptions
  add column if not exists payment_provider   text not null default 'manual',
  add column if not exists payment_session_id text,
  add column if not exists payment_intent_id  text,
  add column if not exists paid_at            timestamptz;

alter table public.service_orders
  drop constraint if exists service_orders_payment_provider_check;
alter table public.service_orders
  add constraint service_orders_payment_provider_check
  check (payment_provider in ('manual', 'xpay'));

alter table public.course_subscriptions
  drop constraint if exists course_subscriptions_payment_provider_check;
alter table public.course_subscriptions
  add constraint course_subscriptions_payment_provider_check
  check (payment_provider in ('manual', 'xpay'));


-- ─────────────────────────────────────────────────────────────────────────
-- ٢) طرق الدفع الإلكترونية مسموحة
-- ─────────────────────────────────────────────────────────────────────────
-- نفس القايمة اللي على `orders` بالظبط — عشان الشاشات تقرا اسمًا واحدًا.
alter table public.service_orders
  drop constraint if exists service_orders_payment_method_check;
alter table public.service_orders
  add constraint service_orders_payment_method_check
  check (payment_method is null or payment_method in (
    'instapay', 'vodafone_cash', 'card', 'fawry', 'valu', 'apple_pay', 'wallet'
  ));

alter table public.course_subscriptions
  drop constraint if exists course_subscriptions_payment_method_check;
alter table public.course_subscriptions
  add constraint course_subscriptions_payment_method_check
  check (payment_method is null or payment_method in (
    'instapay', 'vodafone_cash', 'card', 'fawry', 'valu', 'apple_pay', 'wallet'
  ));


-- ─────────────────────────────────────────────────────────────────────────
-- ٣) سجل أحداث الدفع بيستوعب الأنواع التلاتة
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ `order_id` بيفضل زي ما هو بمفتاحه الأجنبي (طلبات «إنها لك»)، والنوع
--    الجديد بيتكتب في `source_kind`/`source_id` — **بلا مفتاح أجنبي**،
--    لأن المصدر ممكن يكون أي من تلات جداول. ومنع التكرار شغّال على
--    `id` (رقم الحدث من البوابة) فمش متأثر.
alter table public.payment_events
  add column if not exists source_kind text not null default 'order',
  add column if not exists source_id   uuid;

alter table public.payment_events
  drop constraint if exists payment_events_source_kind_check;
alter table public.payment_events
  add constraint payment_events_source_kind_check
  check (source_kind in ('order', 'service_order', 'course_subscription'));

-- الصفوف القديمة كلها طلبات — بنملا `source_id` منها مرة واحدة.
update public.payment_events
   set source_id = order_id
 where source_id is null and order_id is not null;

create index if not exists payment_events_source_idx
  on public.payment_events (source_kind, source_id, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────
-- ٤) إصلاح: ربط جلسة الدفع بالطلب كان بيترجع في صمت
-- ─────────────────────────────────────────────────────────────────────────
-- الحارس بيرجّع `payment_provider` و`payment_session_id` لأي نداء من
-- العميل. العلامة دي بتتحط من `attach_payment_session` وحدها، وبتعيش
-- جوّه المعاملة بس، وبتسمح بالعمودين دول **لا غير**.
--
-- ⚠️ النسخة دي بتحافظ على استثناء إلغاء العميل (`app.customer_cancel`)
--    من 20261015071231 حرفًا بحرف — لو اتشال، زرار «إلغاء الطلب» بيبطّل
--    يشتغل تاني.
create or replace function public.guard_order_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  v_attaching boolean := coalesce(current_setting('app.gateway_attach', true), '') = 'on';
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- الاستثناءان الوحيدان للعميل في الحالة:
  --   ١) «حوّلت» + الإيصال.
  --   ٢) إلغاء طلبه هو وهو لسه مادفعش.
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

  -- ⚠️ العمودين دول بس اللي العلامة بتفتحهم — وبدء دفع إلكتروني مش
  --    بيغيّر حالة ولا مبلغ ولا ملكية.
  IF NOT v_attaching THEN
    NEW.payment_provider    := OLD.payment_provider;
    NEW.payment_session_id  := OLD.payment_session_id;
  END IF;

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


create or replace function public.attach_payment_session(
  p_order_id uuid,
  p_session_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order   record;
  v_stored  text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  if nullif(btrim(coalesce(p_session_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'missing_session');
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v_order.user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_your_order');
  end if;
  if v_order.status not in ('pending', 'failed') then
    return jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', v_order.status);
  end if;

  perform set_config('app.gateway_attach', 'on', true);
  update orders
     set payment_provider   = 'xpay',
         payment_session_id = btrim(p_session_id),
         updated_at         = now()
   where id = p_order_id;
  perform set_config('app.gateway_attach', 'off', true);

  -- ⚠️ **التأكد إن الكتابة حصلت.** ده بالظبط اللي كان ناقص: الحارس
  --    بيصحّح الصفوف في صمت، فالتحديث كان «ينجح» والعمود مايتغيّرش.
  select payment_session_id into v_stored from orders where id = p_order_id;
  if v_stored is distinct from btrim(p_session_id) then
    return jsonb_build_object('ok', false, 'error', 'blocked');
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.attach_payment_session(uuid, text) from public, anon;
grant execute on function public.attach_payment_session(uuid, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- ٥) ربط جلسة الدفع بخدمة أو حجز
-- ─────────────────────────────────────────────────────────────────────────
-- الحارسان على الجدولين مابيلمسوش الأعمدة الجديدة، فمفيش علامة محتاجة
-- هنا — ومع ذلك بنتأكد من الكتابة بنفس الطريقة، لأن «نجحت» من غير تأكيد
-- هي اللي ضيّعتنا قبل كده.
create or replace function public.attach_payment_session_cw(
  p_kind       text,
  p_id         uuid,
  p_session_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner   uuid;
  v_status  text;
  v_stored  text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  if nullif(btrim(coalesce(p_session_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'missing_session');
  end if;

  if p_kind = 'service_order' then
    select buyer_profile_id, status::text into v_owner, v_status
      from service_orders where id = p_id for update;
  elsif p_kind = 'course_subscription' then
    select user_id, status into v_owner, v_status
      from course_subscriptions where id = p_id for update;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_kind');
  end if;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_your_order');
  end if;
  -- مفيش حالة `failed` هنا: المحاولة الفاشلة بتسيب الصف `pending`،
  -- فده الشرط الوحيد اللي يسمح بمحاولة دفع.
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', v_status);
  end if;

  if p_kind = 'service_order' then
    update service_orders
       set payment_provider = 'xpay', payment_session_id = btrim(p_session_id)
     where id = p_id;
    select payment_session_id into v_stored from service_orders where id = p_id;
  else
    update course_subscriptions
       set payment_provider = 'xpay', payment_session_id = btrim(p_session_id)
     where id = p_id;
    select payment_session_id into v_stored from course_subscriptions where id = p_id;
  end if;

  if v_stored is distinct from btrim(p_session_id) then
    return jsonb_build_object('ok', false, 'error', 'blocked');
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.attach_payment_session_cw(text, uuid, text) from public, anon;
grant execute on function public.attach_payment_session_cw(text, uuid, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- ٦) تسجيل نتيجة الدفع لخدمة أو حجز (من الويبهوك)
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ **بتقف عند تسجيل الدفعة.** الحجز بيبقى `active` والخدمة `paid`،
--    لكن **توليد الجلسات ومهلة مقدّم الخدمة والإشعارات شغل التطبيق** —
--    الويبهوك بينادي نفس الكود اللي الإدارة بتناديه بعد ما الدالة دي
--    ترجّع `paid`. لو حد ناداها لوحدها، الحجز هيبقى نشطًا بلا جلسات.
create or replace function public.record_gateway_payment_cw(
  p_event_id     text,
  p_event_type   text,
  p_kind         text,
  p_id           uuid,
  p_session_id   text,
  p_intent_id    text,
  p_amount_minor bigint,
  p_method       text,
  p_payload      jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_status   text;
  v_amount   numeric;
  v_expected bigint;
  v_method   text := lower(btrim(coalesce(p_method, '')));
  v_outcome  text;
begin
  if nullif(btrim(coalesce(p_event_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'outcome', 'missing_event_id');
  end if;
  if p_kind not in ('service_order', 'course_subscription') then
    return jsonb_build_object('ok', false, 'outcome', 'bad_kind');
  end if;

  -- منع التكرار: أول إدخال للحدث هو اللي بيعالج.
  insert into payment_events (id, event_type, order_id, source_kind, source_id,
                              outcome, amount_minor, payload)
  values (p_event_id, coalesce(p_event_type, 'unknown'), null, p_kind, p_id,
          'processing', p_amount_minor, p_payload)
  on conflict (id) do nothing;

  if not found then
    return jsonb_build_object('ok', true, 'outcome', 'duplicate');
  end if;

  if p_kind = 'service_order' then
    select status::text, amount into v_status, v_amount
      from service_orders where id = p_id for update;
  else
    select status, amount into v_status, v_amount
      from course_subscriptions where id = p_id for update;
  end if;

  if v_status is null then
    update payment_events set outcome = 'order_not_found' where id = p_event_id;
    return jsonb_build_object('ok', false, 'outcome', 'order_not_found');
  end if;

  -- فشل أو انتهاء صلاحية: الصف بيفضل `pending` (مفيش حالة `failed` هنا)،
  -- فالعميل يقدر يحاول تاني، وبنسجّل السبب بس.
  if p_event_type is distinct from 'checkout.session.completed' then
    v_outcome := case
      when p_event_type in ('checkout.session.expired', 'payment_intent.payment_failed')
        then 'left_pending' else 'ignored' end;
    update payment_events set outcome = v_outcome where id = p_event_id;
    return jsonb_build_object('ok', true, 'outcome', v_outcome);
  end if;

  if v_status <> 'pending' and v_status <> 'awaiting_verification' then
    update payment_events set outcome = 'already_paid' where id = p_event_id;
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;

  -- ⚠️ المبلغ: الصف بالجنيه والبوابة بالقرش. الاختلاف = خطأ ربط أو
  --    تلاعب، والاتنين يوقفوا التأكيد.
  v_expected := round(coalesce(v_amount, 0))::bigint * 100;
  if p_amount_minor is null or p_amount_minor <> v_expected then
    update payment_events set outcome = 'amount_mismatch' where id = p_event_id;
    return jsonb_build_object('ok', false, 'outcome', 'amount_mismatch',
                              'expected_minor', v_expected, 'received_minor', p_amount_minor);
  end if;

  if nullif(btrim(coalesce(p_intent_id, '')), '') is null then
    update payment_events set outcome = 'missing_intent' where id = p_event_id;
    return jsonb_build_object('ok', false, 'outcome', 'missing_intent');
  end if;

  if v_method not in ('card', 'fawry', 'valu', 'apple_pay', 'wallet') then
    v_method := 'card';
  end if;

  if p_kind = 'service_order' then
    update service_orders
       set status             = 'paid',
           payment_provider   = 'xpay',
           payment_method     = v_method,
           payment_intent_id  = btrim(p_intent_id),
           payment_session_id = coalesce(nullif(btrim(coalesce(p_session_id, '')), ''), payment_session_id),
           paid_at            = now()
     where id = p_id;
  else
    -- ⚠️ `started_at` بيتحط هنا زي التأكيد اليدوي بالظبط — الجلسات
    --    بتتولّد من التطبيق بعد كده، مش من هنا.
    update course_subscriptions
       set status             = 'active',
           started_at         = coalesce(started_at, now()),
           payment_provider   = 'xpay',
           payment_method     = v_method,
           payment_intent_id  = btrim(p_intent_id),
           payment_session_id = coalesce(nullif(btrim(coalesce(p_session_id, '')), ''), payment_session_id),
           paid_at            = now()
     where id = p_id;
  end if;

  update payment_events set outcome = 'paid' where id = p_event_id;
  return jsonb_build_object('ok', true, 'outcome', 'paid', 'kind', p_kind, 'id', p_id);
end $$;

revoke all on function public.record_gateway_payment_cw(text, text, text, uuid, text, text, bigint, text, jsonb)
  from public, anon, authenticated;


-- ============================================================================
-- التحقق — قراءة بس
-- ============================================================================
--   select 'أعمدة' as what,
--          (select count(*) from information_schema.columns
--            where table_schema='public' and table_name='service_orders'
--              and column_name in ('payment_provider','payment_session_id','payment_intent_id','paid_at')) as service_orders,
--          (select count(*) from information_schema.columns
--            where table_schema='public' and table_name='course_subscriptions'
--              and column_name in ('payment_provider','payment_session_id','payment_intent_id','paid_at')) as courses;
--   -- المفروض 4 و4.
--
--   select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public'
--      and proname in ('attach_payment_session','attach_payment_session_cw','record_gateway_payment_cw');
--   -- المفروض تلاتة.
--
-- ============================================================================
-- الرجوع
-- ============================================================================
--   drop function if exists public.record_gateway_payment_cw(text,text,text,uuid,text,text,bigint,text,jsonb);
--   drop function if exists public.attach_payment_session_cw(text,uuid,text);
--   -- و`guard_order_fields` و`attach_payment_session` يرجعوا من
--   -- 20261015071231_customer_cancel_passes_order_guard.sql و
--   -- 20261015060000_xpay_payment_gateway.sql على الترتيب.
--   -- الأعمدة والقيود ممكن تفضل — مالهاش أثر وهي فاضية.
-- ============================================================================
