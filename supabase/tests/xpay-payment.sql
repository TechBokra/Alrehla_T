-- ============================================================================
-- اختبار بوابة الدفع — يدوي، داخل transaction بتتلغي في الآخر
-- ============================================================================
-- الاستعمال: الصقه كله في Supabase ← SQL Editor وشغّله **بعد** تطبيق
--            migration ‏20261015060000_xpay_payment_gateway.sql.
--
-- ⚠️ بينتهي بـ`raise exception` عشان كل حاجة تترجع. ظهور رسالة
--    «RESULT: …» معناه **نجاح**، مش خطأ. أي بيانات اتعملت بتختفي.
--
-- النتيجة المتوقعة (كل واحدة لازم تطابق):
--   1_paid=paid/paid          دفعة سليمة → الطلب مدفوع
--   2_replay=duplicate        إعادة إرسال نفس الحدث → مابتتعالجش تاني
--   3_wrong_amount=amount_mismatch/pending   مبلغ غلط → الطلب فضل معلّق
--   4_no_intent=missing_intent/pending       بلا مرجع دفعة → مرفوض
--   5_failed=marked_failed/failed            فشل الدفع → الطلب failed
--   6_forged=BLOCKED          محاولة تأكيد دفع بلا مرجع → القاعدة رفضت
--   8_change_after_paid=BLOCKED              تغيير دليل الدفع بعد التأكيد → مرفوض
--   7_manual=OK               التحويل اليدوي القديم لسه شغّال
-- ============================================================================

begin;

do $$
declare
  v_user uuid; v_order uuid; v_o2 uuid; v_res jsonb; v_status text; out_text text := '';
begin
  select id into v_user from user_profiles limit 1;

  -- (١) دفعة سليمة
  insert into orders (user_id, total_amount, status, shipping_fee, country_code)
  values (v_user, 250, 'pending', 0, 'EG') returning id into v_order;
  v_res := record_gateway_payment('t_evt_ok','checkout.session.completed',v_order,'cs_1','pi_1',25000,'card');
  select status into v_status from orders where id = v_order;
  out_text := out_text || format('1_paid=%s/%s; ', v_res->>'outcome', v_status);

  -- (٢) إعادة إرسال نفس الحدث
  v_res := record_gateway_payment('t_evt_ok','checkout.session.completed',v_order,'cs_1','pi_1',25000,'card');
  out_text := out_text || format('2_replay=%s; ', v_res->>'outcome');

  -- (٣) مبلغ لا يطابق إجمالي الطلب
  insert into orders (user_id, total_amount, status, shipping_fee, country_code)
  values (v_user, 300, 'pending', 0, 'EG') returning id into v_o2;
  v_res := record_gateway_payment('t_evt_bad','checkout.session.completed',v_o2,'cs_2','pi_2',100,'card');
  select status into v_status from orders where id = v_o2;
  out_text := out_text || format('3_wrong_amount=%s/%s; ', v_res->>'outcome', v_status);

  -- (٤) بلا مرجع دفعة
  v_res := record_gateway_payment('t_evt_noint','checkout.session.completed',v_o2,'cs_2','',30000,'card');
  select status into v_status from orders where id = v_o2;
  out_text := out_text || format('4_no_intent=%s/%s; ', v_res->>'outcome', v_status);

  -- (٥) فشل الدفع
  v_res := record_gateway_payment('t_evt_fail','payment_intent.payment_failed',v_o2,'cs_2',null,null,null);
  select status into v_status from orders where id = v_o2;
  out_text := out_text || format('5_failed=%s/%s; ', v_res->>'outcome', v_status);

  -- (٦) محاولة تأكيد دفع بلا مرجع من البوابة
  begin
    update orders set status='paid', payment_provider='xpay', payment_method='card' where id = v_o2;
    out_text := out_text || '6_forged=ALLOWED_BAD; ';
  exception when others then out_text := out_text || '6_forged=BLOCKED; '; end;

  -- (٨) تغيير دليل الدفع بعد التأكيد
  begin
    update orders set payment_intent_id='pi_x', payment_method='valu' where id = v_order;
    out_text := out_text || '8_change_after_paid=ALLOWED_BAD; ';
  exception when others then out_text := out_text || '8_change_after_paid=BLOCKED; '; end;

  -- (٧) التحويل اليدوي القديم
  insert into orders (user_id, total_amount, status, shipping_fee, country_code)
  values (v_user, 100, 'pending', 0, 'EG') returning id into v_order;
  begin
    update orders set status='awaiting_verification', payment_method='instapay',
      payment_receipt_url='private:jpg:alrehla/private/receipts/x.jpg' where id = v_order;
    out_text := out_text || '7_manual=OK; ';
  exception when others then out_text := out_text || format('7_manual=BROKEN(%s); ', sqlerrm); end;

  raise exception 'RESULT: %', out_text;
end $$;

rollback;
