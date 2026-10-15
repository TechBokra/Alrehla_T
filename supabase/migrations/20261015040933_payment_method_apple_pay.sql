-- ============================================================================
-- وسائل الدفع: إضافة apple_pay وإبقاء wallet للطلبات القديمة
-- ============================================================================
-- الغرض   : `wallet` كانت قيمة من اختراعنا — البوابة بترفضها برسالة
--             Invalid option: expected one of "card"|"fawry"|"valu"|"apple_pay"
--           فكل محاولة دفع بالبوابة كانت بتفشل. بنضيف `apple_pay`.
--
-- الأثر   : توسيع قيد `orders_payment_method_check`، وتحديث الدالتين اللي
--           بتتحققوا من وسيلة الدفع. مفيش طلب بيتغيّر: `wallet` بتفضل
--           مقبولة لأن الويبهوك ممكن يبعتها لمحفظة إلكترونية، ولأن أي
--           طلب قديم اتسجّل بيها يفضل صالح.
--
-- كمان    : بنشيل `wallet` من قايمة الوسائل المعروضة في إعدادات الدفع،
--           لأن البوابة مابتقبلهاش في `paymentMethodTypes`.
--
-- الترتيب : يتطبّق مع نشر الكود أو قبله. الكود القديم مابيعرفش apple_pay
--           فمابيتأثرش.
--
-- التحقق  : select pg_get_constraintdef(oid) from pg_constraint
--             where conname = 'orders_payment_method_check';
--
-- الرجوع  : رجّع القيد من غير 'apple_pay' بعد ما تتأكد إن مفيش طلب بيها.
-- ============================================================================

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (
    payment_method is null
    or payment_method in ('instapay', 'vodafone_cash', 'card', 'fawry', 'valu', 'wallet', 'apple_pay')
  );

-- الويبهوك: نفس القايمة، والمجهول بيرجع 'card'.
create or replace function public.record_gateway_payment(
  p_event_id     text,
  p_event_type   text,
  p_order_id     uuid,
  p_session_id   text,
  p_intent_id    text,
  p_amount_minor bigint,
  p_method       text,
  p_payload      jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order   record;
  v_outcome text;
  v_method  text := lower(btrim(coalesce(p_method, '')));
  v_expected_minor bigint;
begin
  if nullif(btrim(coalesce(p_event_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'outcome', 'missing_event_id');
  end if;

  insert into payment_events (id, event_type, order_id, outcome, amount_minor, payload)
  values (p_event_id, coalesce(p_event_type, 'unknown'), p_order_id, 'processing', p_amount_minor, p_payload)
  on conflict (id) do nothing;

  if not found then
    return jsonb_build_object('ok', true, 'outcome', 'duplicate');
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    update payment_events set outcome = 'order_not_found' where id = p_event_id;
    return jsonb_build_object('ok', false, 'outcome', 'order_not_found');
  end if;

  if p_event_type is distinct from 'checkout.session.completed' then
    if v_order.status = 'pending' and p_event_type in ('checkout.session.expired', 'payment_intent.payment_failed') then
      update orders
         set status = 'failed', payment_provider = 'xpay', updated_at = now()
       where id = v_order.id;
      v_outcome := 'marked_failed';
    else
      v_outcome := 'ignored';
    end if;
    update payment_events set outcome = v_outcome where id = p_event_id;
    return jsonb_build_object('ok', true, 'outcome', v_outcome);
  end if;

  if v_order.status in ('paid', 'preparing', 'shipped', 'delivered') then
    update payment_events set outcome = 'already_paid' where id = p_event_id;
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;

  v_expected_minor := v_order.total_amount::bigint * 100;
  if p_amount_minor is null or p_amount_minor <> v_expected_minor then
    update payment_events set outcome = 'amount_mismatch' where id = p_event_id;
    return jsonb_build_object(
      'ok', false, 'outcome', 'amount_mismatch',
      'expected_minor', v_expected_minor, 'received_minor', p_amount_minor);
  end if;

  if nullif(btrim(coalesce(p_intent_id, '')), '') is null then
    update payment_events set outcome = 'missing_intent' where id = p_event_id;
    return jsonb_build_object('ok', false, 'outcome', 'missing_intent');
  end if;

  if v_method not in ('card', 'fawry', 'valu', 'wallet', 'apple_pay') then
    v_method := 'card';
  end if;

  update orders
     set status             = 'paid',
         payment_provider   = 'xpay',
         payment_method     = v_method,
         payment_intent_id  = btrim(p_intent_id),
         payment_session_id = coalesce(nullif(btrim(coalesce(p_session_id, '')), ''), payment_session_id),
         paid_at            = now(),
         updated_at         = now()
   where id = v_order.id;

  update payment_events set outcome = 'paid' where id = p_event_id;
  return jsonb_build_object('ok', true, 'outcome', 'paid', 'order_id', v_order.id);
end $$;

revoke all on function public.record_gateway_payment(text, text, uuid, text, text, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_gateway_payment(text, text, uuid, text, text, bigint, text, jsonb)
  to service_role;

-- الإعداد المحفوظ فيه `wallet` اللي البوابة بترفضها — بتتشال.
update public.site_settings
   set value = jsonb_set(
         value,
         '{methods}',
         coalesce(
           (select jsonb_agg(m) from jsonb_array_elements_text(value -> 'methods') m
             where m <> 'wallet'),
           '["card"]'::jsonb))
 where key = 'payments'
   and value -> 'methods' @> '["wallet"]'::jsonb;
