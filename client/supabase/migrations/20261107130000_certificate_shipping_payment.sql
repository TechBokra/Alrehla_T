-- =====================================================================
-- 20261107130000 — رسوم شحن الشهادة الورقية (دفع أونلاين قبل الطباعة)
-- =====================================================================
--
-- الغرض:
--   الشهادة نفسها مجانية، والنسخة الورقية بيدفع ولي الأمر شحنها (قرار ٧
--   نوفمبر). الرسوم من نفس جدول الشحن بتاع الطلبات (`shipping_quote`) حسب
--   المحافظة والمنطقة، والدفع بالبوابة (XPay) قبل ما مهمة الطباعة تتفتح.
--
--   المسار بقى: صدرت ← (طلب ورقية) بانتظار دفع الشحن ← (اتدفع) طباعة ←
--   شحن ← اتسلّمت. ولو الرسوم صفر (منطقة مجانية) بيروح للطباعة على طول.
--
-- الأثر:
--   • أعمدة جديدة في course_certificates: country_code, shipping_fee,
--     payment_reference, payment_provider, payment_session_id,
--     payment_intent_id, payment_method, paid_at.
--   • حالة جديدة awaiting_payment في قيد الحالة.
--   • payment_events.source_kind بيقبل 'certificate'.
--   • course_certificate_request_paper اتغيّرت (باراميتر الدولة + حساب الرسوم)
--     — النسخة القديمة بتتشال (عمرها ساعات ومحدش بيناديها غير الموقع).
--   • دوال جديدة: course_certificate_cancel_paper, attach_payment_session_cert,
--     record_gateway_payment_cert.
--   • course_certificate_task_fn: إشعار «جاهزة» مايتكررش لو ولي الأمر لغى طلب الورقية.
--   لا تعديل على بيانات موجودة.
--
-- الترتيب: بعد 20261107120000.
--
-- التحقق بعد التشغيل:
--   select pg_get_function_identity_arguments('public.course_certificate_request_paper'::regproc);
--   → فيه p_country
--
-- الرجوع: الأعمدة الجديدة مابتضرّش؛ لإرجاع الدالة القديمة شغّل تعريفها من 20261107120000.
-- =====================================================================

ALTER TABLE public.course_certificates
  ADD COLUMN IF NOT EXISTS country_code       text,
  ADD COLUMN IF NOT EXISTS shipping_fee       numeric,
  ADD COLUMN IF NOT EXISTS payment_reference  text,
  ADD COLUMN IF NOT EXISTS payment_provider   text,
  ADD COLUMN IF NOT EXISTS payment_session_id text,
  ADD COLUMN IF NOT EXISTS payment_intent_id  text,
  ADD COLUMN IF NOT EXISTS payment_method     text,
  ADD COLUMN IF NOT EXISTS paid_at            timestamptz;

ALTER TABLE public.course_certificates DROP CONSTRAINT IF EXISTS course_certificates_status_check;
ALTER TABLE public.course_certificates ADD CONSTRAINT course_certificates_status_check
  CHECK (status IN ('pending', 'issued', 'awaiting_payment', 'print_requested', 'shipped', 'delivered'));

ALTER TABLE public.payment_events DROP CONSTRAINT IF EXISTS payment_events_source_kind_check;
ALTER TABLE public.payment_events ADD CONSTRAINT payment_events_source_kind_check
  CHECK (source_kind = ANY (ARRAY['order', 'service_order', 'course_subscription', 'certificate']));

-- ── المهمة والإشعار ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.course_certificate_task_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  v_title text := 'شهادة إتمام — ' || left(new.participant_name, 60);
  v_link  text := '/dashboard/admin/bookings/certificates';
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  begin
    if new.status = 'pending' then
      perform public.work_task_open('certificates', 'fulfilment', new.id::text, new.package_name, v_title, v_link, true, 'issue');
    elsif new.status = 'print_requested' then
      perform public.work_task_open('certificates', 'fulfilment', new.id::text, new.certificate_no, v_title, v_link, true, 'print');
    elsif new.status = 'shipped' then
      perform public.work_task_open('certificates', 'fulfilment', new.id::text, new.certificate_no, v_title, v_link, true, 'shipping');
    else
      -- issued / awaiting_payment / delivered: مفيش شغل على الإدارة.
      perform public.work_task_close('certificates', 'fulfilment', new.id::text);
    end if;

    -- «جاهزة» مرة واحدة: وقت الإصدار، مش لما ولي الأمر يلغي طلب الورقية.
    if new.status = 'issued' and (tg_op = 'INSERT' or old.status = 'pending') then
      insert into notifications (recipient_profile_id, title, message, link)
      values (new.owner_id::text, 'شهادة الإتمام جاهزة 🎉',
              'شهادة ' || new.participant_name || ' في «' || new.package_name || '» جاهزة — تقدر تفتحها وتطبعها، أو تطلب نسخة ورقية.',
              '/account/bookings');
    elsif new.status = 'shipped' then
      insert into notifications (recipient_profile_id, title, message, link)
      values (new.owner_id::text, 'الشهادة الورقية في الطريق',
              'شهادة ' || new.participant_name || ' اتشحنت' || coalesce(' — رقم الشحنة ' || new.tracking_reference, '') || '.',
              '/account/bookings');
    end if;
  exception when others then
    raise warning 'course_certificate_task_fn: certificate % — %', new.id, sqlerrm;
  end;
  return new;
end;
$fn$;

-- ── طلب نسخة ورقية: الرسوم من جدول الشحن ──────────────────────────
DROP FUNCTION IF EXISTS public.course_certificate_request_paper(uuid, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.course_certificate_request_paper(
  p_id uuid, p_recipient_name text, p_recipient_phone text, p_address_line text,
  p_city text, p_governorate text, p_notes text DEFAULT NULL, p_country text DEFAULT 'EG')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  q       record;
  v_fee   numeric;
  v_next  text;
begin
  if auth.uid() is null then
    raise exception 'سجّل الدخول الأول' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_recipient_name, ''))) < 2
     or char_length(regexp_replace(coalesce(p_recipient_phone, ''), '\D', '', 'g')) < 8
     or char_length(btrim(coalesce(p_address_line, ''))) < 5
     or char_length(btrim(coalesce(p_city, ''))) < 2
     or char_length(btrim(coalesce(p_governorate, ''))) < 2 then
    raise exception 'كمّل بيانات الشحن: الاسم والموبايل والعنوان والمدينة والمحافظة' using errcode = 'P0001';
  end if;

  select * into q from public.shipping_quote(p_country, p_governorate, p_city);
  if not coalesce(q.available, false) then
    raise exception '%', coalesce(q.message, 'التوصيل للمنطقة دي غير متاح الآن') using errcode = 'P0001';
  end if;
  -- البوابة بتاخد جنيهات صحيحة.
  v_fee := ceil(coalesce(q.fee, 0));
  v_next := case when v_fee > 0 then 'awaiting_payment' else 'print_requested' end;

  update course_certificates
     set status = v_next, paper_requested_at = now(),
         recipient_name = left(btrim(p_recipient_name), 80),
         recipient_phone = left(btrim(p_recipient_phone), 30),
         address_line = left(btrim(p_address_line), 300),
         city = left(btrim(p_city), 80),
         governorate = left(btrim(p_governorate), 80),
         country_code = upper(btrim(coalesce(p_country, 'EG'))),
         shipping_notes = nullif(left(btrim(coalesce(p_notes, '')), 300), ''),
         shipping_fee = v_fee,
         payment_reference = case when v_fee > 0 then public.next_payment_reference() end,
         paid_at = case when v_fee > 0 then null else now() end,
         updated_at = now()
   where id = p_id and owner_id = auth.uid() and status = 'issued';
  if not found then
    raise exception 'الطلب ده مش متاح — يمكن اتطلبت نسخة ورقية قبل كده' using errcode = 'P0001';
  end if;
  return jsonb_build_object('status', v_next, 'fee', v_fee);
end;
$fn$;

-- ولي الأمر غيّر رأيه قبل الدفع (أو عايز يصلّح العنوان) ← ترجع «صدرت».
CREATE OR REPLACE FUNCTION public.course_certificate_cancel_paper(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  update course_certificates
     set status = 'issued', paper_requested_at = null, shipping_fee = null,
         payment_reference = null, payment_session_id = null, payment_provider = null,
         updated_at = now()
   where id = p_id and owner_id = auth.uid() and status = 'awaiting_payment';
  if not found then
    raise exception 'الطلب ده مش مستني دفع — حدّث الصفحة' using errcode = 'P0001';
  end if;
end;
$fn$;

-- ── البوابة: ربط الجلسة ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attach_payment_session_cert(p_id uuid, p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  c course_certificates;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  if nullif(btrim(coalesce(p_session_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'missing_session');
  end if;
  select * into c from course_certificates where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if c.owner_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_your_order');
  end if;
  if c.status <> 'awaiting_payment' then
    return jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', c.status);
  end if;
  update course_certificates
     set payment_provider = 'xpay', payment_session_id = btrim(p_session_id), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$fn$;

-- ── البوابة: تسجيل الدفعة (الويبهوك بمفتاح الخدمة) ─────────────────
CREATE OR REPLACE FUNCTION public.record_gateway_payment_cert(
  p_event_id text, p_event_type text, p_id text, p_session_id text, p_intent_id text,
  p_amount_minor bigint, p_method text, p_payload jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  c          course_certificates;
  v_expected bigint;
  v_method   text := lower(btrim(coalesce(p_method, '')));
  v_outcome  text;
begin
  if nullif(btrim(coalesce(p_event_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'outcome', 'missing_event_id');
  end if;

  insert into payment_events (id, event_type, order_id, source_kind, source_id, outcome, amount_minor, payload)
  values (p_event_id, coalesce(p_event_type, 'unknown'), null, 'certificate', p_id, 'processing', p_amount_minor, p_payload)
  on conflict (id) do nothing;
  if not found then
    return jsonb_build_object('ok', true, 'outcome', 'duplicate');
  end if;

  select * into c from course_certificates where id::text = p_id for update;
  if not found then
    update payment_events set outcome = 'order_not_found' where id = p_event_id;
    return jsonb_build_object('ok', false, 'outcome', 'order_not_found');
  end if;

  if p_event_type is distinct from 'checkout.session.completed' then
    v_outcome := case when p_event_type in ('checkout.session.expired', 'payment_intent.payment_failed')
                      then 'left_pending' else 'ignored' end;
    update payment_events set outcome = v_outcome where id = p_event_id;
    return jsonb_build_object('ok', true, 'outcome', v_outcome);
  end if;

  if c.status <> 'awaiting_payment' then
    update payment_events set outcome = 'already_paid' where id = p_event_id;
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;

  v_expected := round(coalesce(c.shipping_fee, 0))::bigint * 100;
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

  update course_certificates
     set status = 'print_requested',
         payment_provider = 'xpay',
         payment_method = v_method,
         payment_intent_id = btrim(p_intent_id),
         payment_session_id = coalesce(nullif(btrim(coalesce(p_session_id, '')), ''), payment_session_id),
         paid_at = now(),
         updated_at = now()
   where id = c.id;

  update payment_events set outcome = 'paid' where id = p_event_id;
  return jsonb_build_object('ok', true, 'outcome', 'paid', 'kind', 'certificate', 'id', p_id);
end;
$fn$;

REVOKE ALL ON FUNCTION public.course_certificate_request_paper(uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.course_certificate_cancel_paper(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attach_payment_session_cert(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_gateway_payment_cert(text, text, text, text, text, bigint, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.course_certificate_request_paper(uuid, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_certificate_cancel_paper(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_payment_session_cert(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_gateway_payment_cert(text, text, text, text, text, bigint, text, jsonb) TO service_role;
