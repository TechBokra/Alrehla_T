-- ============================================================================
-- إصلاح: أرقام «بداية الرحلة» نوعها `text` مش `uuid`
-- ============================================================================
-- العطل   : الدفع بالبوابة في «بداية الرحلة» بيرجّع:
--             42883 — operator does not exist: text = uuid
--
-- السبب   : `service_orders.id` و`course_subscriptions.id` نوعهم **`text`**،
--           وأنا كتبت الدوال الجديدة بـ`p_id uuid`. فالمقارنة
--           `where id = p_id` بقت `text = uuid` وPostgres مالوش عامل
--           للمقارنة دي.
--
--           وجدول `orders` نوع رقمه `uuid` فعلًا — فأنا قستُ الجداول
--           التلاتة على واحد منهم، وده كان افتراضًا مش حقيقة.
--
-- الحل    : الدوال بقت **مش مهتمة بالنوع**: المعامل `text`، والمقارنة
--           `id::text = p_id`. بتشتغل سواء كان العمود `text` أو `uuid`،
--           فلو اتغيّر يومًا مايكسرش حاجة.
--           و`payment_events.source_id` بقى `text` لنفس السبب — كان
--           `uuid` ومش هيقبل رقم حجز نصّي.
--
-- الأثر   : الدالتين `_cw` وعمود واحد. **مسار «إنها لك» مش متلمس خالص**
--           (`orders.id` فعلًا `uuid`، و`attach_payment_session` زيّ ما هي).
--
-- التحقق  : آخر الملف — قراءة بس.
-- ============================================================================


-- ── ١) عمود المصدر في سجل الأحداث يقبل الرقم النصّي ──────────
alter table public.payment_events
  alter column source_id type text using source_id::text;


-- ── ٢) ربط جلسة الدفع ───────────────────────────────────────
drop function if exists public.attach_payment_session_cw(text, uuid, text);

create or replace function public.attach_payment_session_cw(
  p_kind       text,
  p_id         text,
  p_session_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner  text;
  v_status text;
  v_stored text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  if nullif(btrim(coalesce(p_session_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'missing_session');
  end if;

  -- ⚠️ `::text` على الطرفين: العمود `text` في الجدولين دول و`uuid` في
  --    `orders`. المقارنة النصّية بتشتغل في الحالتين.
  if p_kind = 'service_order' then
    select buyer_profile_id::text, status::text into v_owner, v_status
      from service_orders where id::text = p_id for update;
  elsif p_kind = 'course_subscription' then
    select user_id::text, status::text into v_owner, v_status
      from course_subscriptions where id::text = p_id for update;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_kind');
  end if;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v_owner <> auth.uid()::text then
    return jsonb_build_object('ok', false, 'error', 'not_your_order');
  end if;
  -- مفيش حالة `failed` في الجدولين — المحاولة الفاشلة بتسيب الصف `pending`.
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', v_status);
  end if;

  if p_kind = 'service_order' then
    update service_orders
       set payment_provider = 'xpay', payment_session_id = btrim(p_session_id)
     where id::text = p_id;
    select payment_session_id into v_stored from service_orders where id::text = p_id;
  else
    update course_subscriptions
       set payment_provider = 'xpay', payment_session_id = btrim(p_session_id)
     where id::text = p_id;
    select payment_session_id into v_stored from course_subscriptions where id::text = p_id;
  end if;

  -- ⚠️ **بنبلّغ، مابنمنعش.** رقم الجلسة للتتبّع، والويبهوك بيكتبه بعد
  --    الدفع على أي حال — فمينفعش يوقف دفعة. (الدرس ده كلّفنا ساعة
  --    النهاردة على المسار التاني.)
  if v_stored is distinct from btrim(p_session_id) then
    insert into payment_events (id, event_type, order_id, source_kind, source_id, outcome, payload)
    values ('attach_revert_' || p_id || '_' || extract(epoch from now())::bigint::text,
            'session.attach_reverted', null, p_kind, p_id, 'reverted',
            jsonb_build_object('session_id', btrim(p_session_id), 'stored', v_stored))
    on conflict (id) do nothing;
    return jsonb_build_object('ok', true, 'warning', 'session_not_stored');
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.attach_payment_session_cw(text, text, text) from public, anon;
grant execute on function public.attach_payment_session_cw(text, text, text) to authenticated;


-- ── ٣) تسجيل نتيجة الدفع من الويبهوك ────────────────────────
drop function if exists public.record_gateway_payment_cw(text, text, text, uuid, text, text, bigint, text, jsonb);

create or replace function public.record_gateway_payment_cw(
  p_event_id     text,
  p_event_type   text,
  p_kind         text,
  p_id           text,
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
      from service_orders where id::text = p_id for update;
  else
    select status, amount into v_status, v_amount
      from course_subscriptions where id::text = p_id for update;
  end if;

  if v_status is null then
    update payment_events set outcome = 'order_not_found' where id = p_event_id;
    return jsonb_build_object('ok', false, 'outcome', 'order_not_found');
  end if;

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
     where id::text = p_id;
  else
    update course_subscriptions
       set status             = 'active',
           started_at         = coalesce(started_at, now()),
           payment_provider   = 'xpay',
           payment_method     = v_method,
           payment_intent_id  = btrim(p_intent_id),
           payment_session_id = coalesce(nullif(btrim(coalesce(p_session_id, '')), ''), payment_session_id),
           paid_at            = now()
     where id::text = p_id;
  end if;

  update payment_events set outcome = 'paid' where id = p_event_id;
  return jsonb_build_object('ok', true, 'outcome', 'paid', 'kind', p_kind, 'id', p_id);
end $$;

revoke all on function public.record_gateway_payment_cw(text, text, text, text, text, text, bigint, text, jsonb)
  from public, anon, authenticated;


-- ============================================================================
-- التحقق — قراءة بس
-- ============================================================================
--   select p.proname, pg_get_function_arguments(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('attach_payment_session_cw', 'record_gateway_payment_cw');
--   -- لازم `p_id text` في الاتنين، ومفيش نسخة قديمة بـ`uuid`.
--
--   select table_name, column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public' and column_name = 'id'
--      and table_name in ('orders', 'service_orders', 'course_subscriptions');
-- ============================================================================
