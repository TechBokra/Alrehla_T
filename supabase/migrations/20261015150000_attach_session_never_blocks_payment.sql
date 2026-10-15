-- ============================================================================
-- عاجل: ربط جلسة الدفع مايوقفش الدفع
-- ============================================================================
-- العطل   : بعد 20261015140000 بقى الدفع في «إنها لك» بيرجّع
--           «تعذّر فتح صفحة الدفع» (الطلب ALR-000042-2F).
--
-- السبب   : أنا ضفت في `attach_payment_session` قراءة تأكيد بترجّع
--           `blocked` لو رقم الجلسة ماتخزّنش. القصد كان سليم — الدالة
--           كانت بترجّع «تمّ» وهي مش بتحفظ حاجة — لكن **النتيجة إني
--           حوّلت عطلًا صامتًا كان ماشي لعطل واقف يمنع الدفع**.
--
--           ورقم الجلسة ده للتتبّع وبس: الويبهوك بيكتب المزوّد والرقم
--           والنيّة بمفتاح الخدمة بعد الدفع على أي حال. يعني العميل كان
--           بيتمنع من الدفع عشان حاجة مالهاش لزمة في إتمام الدفع نفسه.
--
-- القاعدة  : **حاجة مش ضرورية للدفع ماينفعش توقف الدفع.**
--           التأكيد فضل موجود — بس بيترفع كتحذير في `payment_events`
--           بدل ما يمنع، فإحنا نشوف المشكلة والعميل يكمّل.
--
-- الأثر   : دالتين بس (`attach_payment_session` و`_cw`). مفيش بيانات
--           بتتغيّر، والعلامة والحارس من 20261015140000 زي ما هم.
--
-- التحقق  : الدفع يشتغل تاني. وبعدها:
--             select outcome, count(*) from payment_events
--              where event_type = 'session.attach_reverted'
--              group by outcome;
--           أي صف هنا = الكتابة لسه بتترجع، ولازم نلاقي المحفّز اللي
--           بيرجّعها (غير `guard_order_fields`، اللي العلامة بتفتحه).
--
-- الرجوع  : 20261015140000 فيه النسخة السابقة.
-- ============================================================================

create or replace function public.attach_payment_session(
  p_order_id uuid,
  p_session_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order  record;
  v_stored text;
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

  -- ⚠️ **بنبلّغ، مابنمنعش.** لو الكتابة اترجعت، الدفع بيكمّل عادي
  --    والتحذير بيتسجّل عشان نلاحقه — العميل مالوش ذنب في محفّز عندنا.
  select payment_session_id into v_stored from orders where id = p_order_id;
  if v_stored is distinct from btrim(p_session_id) then
    insert into payment_events (id, event_type, order_id, source_kind, source_id, outcome, payload)
    values ('attach_revert_' || p_order_id::text || '_' || extract(epoch from now())::bigint::text,
            'session.attach_reverted', p_order_id, 'order', p_order_id, 'reverted',
            jsonb_build_object('session_id', btrim(p_session_id), 'stored', v_stored))
    on conflict (id) do nothing;
    return jsonb_build_object('ok', true, 'warning', 'session_not_stored');
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.attach_payment_session(uuid, text) from public, anon;
grant execute on function public.attach_payment_session(uuid, text) to authenticated;


create or replace function public.attach_payment_session_cw(
  p_kind       text,
  p_id         uuid,
  p_session_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner  uuid;
  v_status text;
  v_stored text;
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

  -- نفس القاعدة: بنبلّغ ومابنمنعش الدفع.
  if v_stored is distinct from btrim(p_session_id) then
    insert into payment_events (id, event_type, order_id, source_kind, source_id, outcome, payload)
    values ('attach_revert_' || p_id::text || '_' || extract(epoch from now())::bigint::text,
            'session.attach_reverted', null, p_kind, p_id, 'reverted',
            jsonb_build_object('session_id', btrim(p_session_id), 'stored', v_stored))
    on conflict (id) do nothing;
    return jsonb_build_object('ok', true, 'warning', 'session_not_stored');
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.attach_payment_session_cw(text, uuid, text) from public, anon;
grant execute on function public.attach_payment_session_cw(text, uuid, text) to authenticated;
