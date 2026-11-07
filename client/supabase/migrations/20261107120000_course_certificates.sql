-- =====================================================================
-- 20261107120000 — شهادات إتمام «بداية الرحلة»
-- =====================================================================
--
-- الغرض:
--   الباقات الست واعدة بـ«شهادة إتمام»، ومفيش في النظام أي مكان لها.
--   • لما المشارك يخلّص كل جلسات باقته، بيتعمل صف شهادة «بانتظار الإصدار»
--     ومهمة «إصدار الشهادة» (المسار certificates في «مهامي»).
--   • الإدارة بتراجع الاسم وتصدرها ← رقم شهادة + إشعار لولي الأمر، والشهادة
--     الرقمية تتفتح وتتطبع/تتحفظ PDF من حسابه.
--   • ولي الأمر يقدر يطلب نسخة ورقية بعنوانه ← «الطباعة والتجهيز» ←
--     «الشحن والتسليم» ← تم.
--   • الإدارة تقدر تعمل شهادة يدويًا من صفحة الحجز (لو الجلسات ماتعلّمتش).
--
-- الأثر:
--   • عمود جديد creative_writing_packages.includes_certificate (افتراضي true).
--   • جدول جديد course_certificates + تسلسل لأرقام الشهادات.
--   • محفّز على sessions (لما جلسة تتعلّم «اكتملت»).
--   • دوال: course_certificate_ensure / _create / _issue / _request_paper / _ship / _deliver.
--   • التعديل على الجدول نفسه بالدوال بس (مفيش UPDATE مباشر لأي حد).
--   لا تعديل على بيانات موجودة.
--
-- الترتيب: بعد 20261107100000 (مسار «certificates»).
--
-- التحقق بعد التشغيل:
--   select count(*) from course_certificates;
--   select name, includes_certificate from creative_writing_packages;
--
-- الرجوع: drop table course_certificates cascade; drop sequence course_certificate_seq;
--   alter table creative_writing_packages drop column includes_certificate; drop function للدوال الجديدة.
-- =====================================================================

ALTER TABLE public.creative_writing_packages
  ADD COLUMN IF NOT EXISTS includes_certificate boolean NOT NULL DEFAULT true;

CREATE SEQUENCE IF NOT EXISTS public.course_certificate_seq;

CREATE TABLE IF NOT EXISTS public.course_certificates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     text NOT NULL UNIQUE REFERENCES public.course_subscriptions(id) ON DELETE CASCADE,
  owner_id            uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  participant_name    text NOT NULL CHECK (char_length(btrim(participant_name)) BETWEEN 2 AND 80),
  package_name        text NOT NULL,
  certificate_no      text UNIQUE,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'issued', 'print_requested', 'shipped', 'delivered')),
  completed_at        timestamptz NOT NULL DEFAULT now(),
  issued_at           timestamptz,
  issued_by           uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  paper_requested_at  timestamptz,
  recipient_name      text,
  recipient_phone     text,
  address_line        text,
  city                text,
  governorate         text,
  shipping_notes      text,
  tracking_reference  text,
  shipped_at          timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_certificates_owner_idx ON public.course_certificates (owner_id);
CREATE INDEX IF NOT EXISTS course_certificates_status_idx ON public.course_certificates (status);

ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_certificates_read ON public.course_certificates;
CREATE POLICY course_certificates_read ON public.course_certificates
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.admin_has_permission('canManageBookings'));

-- قراءة بس؛ كل تغيير بالدوال تحت (بتتأكد من الصلاحية والحالة).
REVOKE ALL ON public.course_certificates FROM anon, authenticated;
GRANT SELECT ON public.course_certificates TO authenticated;

COMMENT ON TABLE public.course_certificates IS
  'شهادات إتمام باقات «بداية الرحلة». الحالة: pending ← issued ← (print_requested ← shipped ← delivered). التعديل بدوال course_certificate_* بس.';

-- ── المهمة والإشعار يتبعوا الحالة ───────────────────────────────────
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
      perform public.work_task_close('certificates', 'fulfilment', new.id::text);
    end if;

    if new.status = 'issued' then
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

DROP TRIGGER IF EXISTS course_certificate_task_trg ON public.course_certificates;
CREATE TRIGGER course_certificate_task_trg
  AFTER INSERT OR UPDATE OF status ON public.course_certificates
  FOR EACH ROW EXECUTE FUNCTION public.course_certificate_task_fn();

-- ── إنشاء الشهادة ──────────────────────────────────────────────────
-- p_force = تجاهل عدد الجلسات (الإنشاء اليدوي من الإدارة).
CREATE OR REPLACE FUNCTION public.course_certificate_ensure(p_subscription text, p_force boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  v_id    uuid;
  s       record;
  v_done  integer;
  v_name  text;
begin
  select id into v_id from course_certificates where subscription_id = p_subscription;
  if found then
    return v_id;
  end if;

  select cs.id, cs.user_id, cs.status, cs.participant_type, cs.child_id,
         p.name as package_name, p.sessions_count, p.includes_certificate
    into s
    from course_subscriptions cs
    join creative_writing_packages p on p.id = cs.package_id
   where cs.id = p_subscription;
  if not found or not s.includes_certificate or s.status not in ('active', 'completed') then
    return null;
  end if;

  if not p_force then
    select count(*) into v_done from sessions
     where course_subscription_id = p_subscription and status = 'completed';
    if coalesce(s.sessions_count, 0) <= 0 or v_done < s.sessions_count then
      return null;
    end if;
  end if;

  if s.participant_type = 'child' and s.child_id is not null then
    select full_name into v_name from child_profiles where id::text = s.child_id;
  end if;
  if v_name is null then
    select full_name into v_name from user_profiles where id = s.user_id;
  end if;

  insert into course_certificates (subscription_id, owner_id, participant_name, package_name)
  values (p_subscription, s.user_id, left(coalesce(nullif(btrim(v_name), ''), 'المشارك'), 80), s.package_name)
  on conflict (subscription_id) do nothing
  returning id into v_id;
  return v_id;
end;
$fn$;

REVOKE ALL ON FUNCTION public.course_certificate_ensure(text, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.course_certificate_on_session_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.course_subscription_id is not null then
    begin
      perform public.course_certificate_ensure(new.course_subscription_id, false);
    exception when others then
      raise warning 'course_certificate_on_session_fn: session % — %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$fn$;

DROP TRIGGER IF EXISTS course_certificate_on_session_trg ON public.sessions;
CREATE TRIGGER course_certificate_on_session_trg
  AFTER UPDATE OF status ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.course_certificate_on_session_fn();

-- الإنشاء اليدوي من صفحة الحجز.
CREATE OR REPLACE FUNCTION public.course_certificate_create(p_subscription text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  v_id uuid;
begin
  if not public.admin_has_permission('canManageBookings') then
    raise exception 'مالكش صلاحية إدارة الحجوزات' using errcode = '42501';
  end if;
  v_id := public.course_certificate_ensure(p_subscription, true);
  if v_id is null then
    raise exception 'الحجز ده مش مؤكَّد، أو باقته من غير شهادة' using errcode = 'P0001';
  end if;
  return v_id;
end;
$fn$;

-- ── الإصدار (مراجعة الاسم) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.course_certificate_issue(p_id uuid, p_participant_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  v_name text := btrim(coalesce(p_participant_name, ''));
  v_no   text;
begin
  if not public.admin_has_permission('canManageBookings') then
    raise exception 'مالكش صلاحية إدارة الحجوزات' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'اكتب اسم المشارك كما سيظهر في الشهادة (من ٢ لـ ٨٠ حرف)' using errcode = 'P0001';
  end if;
  v_no := 'ALR-' || to_char(now() at time zone 'Africa/Cairo', 'YYYY') || '-'
          || lpad(nextval('public.course_certificate_seq')::text, 4, '0');
  update course_certificates
     set status = 'issued', participant_name = v_name, certificate_no = v_no,
         issued_at = now(), issued_by = auth.uid(), updated_at = now()
   where id = p_id and status = 'pending';
  if not found then
    raise exception 'الشهادة اتصدرت قبل كده — حدّث الصفحة' using errcode = 'P0001';
  end if;
  return v_no;
end;
$fn$;

-- ── طلب نسخة ورقية (ولي الأمر) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.course_certificate_request_paper(
  p_id uuid, p_recipient_name text, p_recipient_phone text, p_address_line text,
  p_city text, p_governorate text, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
  update course_certificates
     set status = 'print_requested', paper_requested_at = now(),
         recipient_name = left(btrim(p_recipient_name), 80),
         recipient_phone = left(btrim(p_recipient_phone), 30),
         address_line = left(btrim(p_address_line), 300),
         city = left(btrim(p_city), 80),
         governorate = left(btrim(p_governorate), 80),
         shipping_notes = nullif(left(btrim(coalesce(p_notes, '')), 300), ''),
         updated_at = now()
   where id = p_id and owner_id = auth.uid() and status = 'issued';
  if not found then
    raise exception 'الطلب ده مش متاح — يمكن اتطلبت نسخة ورقية قبل كده' using errcode = 'P0001';
  end if;
end;
$fn$;

-- ── الشحن والتسليم (الإدارة) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.course_certificate_ship(p_id uuid, p_tracking text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  if not public.admin_has_permission('canManageBookings') then
    raise exception 'مالكش صلاحية إدارة الحجوزات' using errcode = '42501';
  end if;
  update course_certificates
     set status = 'shipped', shipped_at = now(),
         tracking_reference = nullif(left(btrim(coalesce(p_tracking, '')), 80), ''),
         updated_at = now()
   where id = p_id and status = 'print_requested';
  if not found then
    raise exception 'الشهادة مش في مرحلة الطباعة — حدّث الصفحة' using errcode = 'P0001';
  end if;
end;
$fn$;

CREATE OR REPLACE FUNCTION public.course_certificate_deliver(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  if not public.admin_has_permission('canManageBookings') then
    raise exception 'مالكش صلاحية إدارة الحجوزات' using errcode = '42501';
  end if;
  update course_certificates
     set status = 'delivered', delivered_at = now(), updated_at = now()
   where id = p_id and status = 'shipped';
  if not found then
    raise exception 'الشهادة مش في الشحن — حدّث الصفحة' using errcode = 'P0001';
  end if;
end;
$fn$;

REVOKE ALL ON FUNCTION public.course_certificate_create(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.course_certificate_issue(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.course_certificate_request_paper(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.course_certificate_ship(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.course_certificate_deliver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.course_certificate_create(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_certificate_issue(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_certificate_request_paper(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_certificate_ship(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_certificate_deliver(uuid) TO authenticated;
