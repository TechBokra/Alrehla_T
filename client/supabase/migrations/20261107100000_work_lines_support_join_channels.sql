-- =====================================================================
-- 20261107100000 — مجالات جديدة في «سير العمل والتوزيع»
-- =====================================================================
--
-- الغرض:
--   «مهامي» كانت بتغطي ٣ منظومات بس (إنها لك، بداية الرحلة، الخدمات).
--   الملف ده بيضيف مسارات جديدة ويوصّل أول تلاتة منهم بمصادرهم:
--
--   • support   — تذاكر الدعم وطلبات جلسة الدعم: مهمة لكل تذكرة مفتوحة
--                 (بتتقفل لما الإدارة ترد، وبتتفتح تاني لو العميل رد).
--   • channels  — واتساب والإيميل: مهمة يومية «راجع الرسائل» لمسؤول القناة.
--                 القناة بتشتغل **بس لما يتحدد لها مسؤول** في سير العمل.
--   • join      — طلبات الانضمام: «مراجعة وتواصل» ثم «القرار» بعد أول رسالة
--                 من الإدارة، وبتتقفل بالقبول أو الرفض.
--   • blog / certificates — المسار بس هنا؛ التفاصيل في ملفّي 110000 و120000.
--
-- الأثر:
--   • قيود `line` في work_tasks / assignment_rules / task_steps بتتوسّع
--     (إضافة قيم، مفيش قيمة قديمة بتتشال).
--   • مراحل جديدة في task_steps (لو موجودة مابتتغيّرش).
--   • محفّزات جديدة على support_tickets / support_ticket_messages /
--     support_session_requests / join_requests / join_request_messages.
--   • التذاكر وطلبات الانضمام المفتوحة دلوقتي بتاخد مهمة (مرة واحدة).
--   • `work_tasks_sweep_if_due` بقت كمان بتفتح مهام القنوات اليومية.
--   لا حذف لأي بيانات.
--
-- الترتيب: بعد كل ملفات «مهامي» السابقة. قبل 110000 و120000.
--
-- التحقق بعد التشغيل:
--   select line, step, label from task_steps
--    where line in ('support','channels','join','blog','certificates') order by line, sort_order;
--   select line, step, title from work_tasks where line in ('support','join') and status = 'open';
--
-- الرجوع: drop trigger لكل محفّز جديد + drop function للدوال الجديدة؛ القيود
--   الأوسع مابتضرّش. مهام المسارات الجديدة ممكن تتقفل من «مهامي».
-- =====================================================================

-- ── ١) المسارات المسموحة ─────────────────────────────────────────────
ALTER TABLE public.work_tasks DROP CONSTRAINT IF EXISTS work_tasks_line;
ALTER TABLE public.work_tasks ADD CONSTRAINT work_tasks_line CHECK (line = ANY (ARRAY[
  'enha_lak','box','courses','services','studio','support','channels','join','blog','certificates']));

ALTER TABLE public.assignment_rules DROP CONSTRAINT IF EXISTS assignment_rules_line;
ALTER TABLE public.assignment_rules ADD CONSTRAINT assignment_rules_line CHECK (line = ANY (ARRAY[
  'enha_lak','box','courses','services','studio','support','channels','join','blog','certificates']));

ALTER TABLE public.task_steps DROP CONSTRAINT IF EXISTS task_steps_line;
ALTER TABLE public.task_steps ADD CONSTRAINT task_steps_line CHECK (line = ANY (ARRAY[
  'enha_lak','box','courses','services','studio','support','channels','join','blog','certificates']));

-- ── ٢) المراحل (الإدارة تقدر تغيّر الأسماء والمهل من سير العمل) ──────
-- «fulfilment» = المسؤولين الافتراضيين للمسار كله لو المرحلة مالهاش مسؤول.
INSERT INTO public.task_steps (line, step, label, hint, sla_hours, owner_kind, sort_order) VALUES
  ('support',  'fulfilment',      'المتابعة',              NULL, 24,  'rule', 20),
  ('support',  'ticket',          'الرد على التذكرة',       'تذكرة مفتوحة مستنية رد الدعم. بتتقفل لوحدها لما ترد، وبترجع لو العميل رد تاني.', 24, 'rule', 21),
  ('support',  'session_request', 'التواصل لجلسة دعم',     'العميل طلب حد يكلّمه. بتتقفل لما الطلب يتعلّم «تم التواصل» أو «اتحل».', 24, 'rule', 22),
  ('channels', 'fulfilment',      'المتابعة',              NULL, 24,  'rule', 20),
  ('channels', 'whatsapp',        'رسائل واتساب اليوم',     'مهمة يومية: رد على رسائل واتساب، وحوّل أي طلب أو شكوى لتذكرة. بتتفتح بس لو للقناة مسؤول.', 10, 'rule', 21),
  ('channels', 'email',           'بريد اليوم',            'مهمة يومية: رد على بريد المنصة الوارد. بتتفتح بس لو للقناة مسؤول.', 10, 'rule', 22),
  ('join',     'fulfilment',      'المتابعة',              NULL, 72,  'rule', 20),
  ('join',     'review',          'مراجعة الطلب والتواصل',  'طلب جديد: راجع البيانات والأعمال وابعت أول رسالة لمقدّم الطلب.', 48, 'rule', 21),
  ('join',     'decision',        'القرار',                'اتواصلنا: كمّل الحوار واقبل أو ارفض.', 168, 'rule', 22),
  ('blog',     'fulfilment',      'المتابعة',              NULL, 72,  'rule', 20),
  ('blog',     'writing',         'الكتابة',               'كتابة المقال المخطّط في المدونة كمسودة.', 120, 'rule', 21),
  ('blog',     'review',          'المراجعة',              'مراجعة المسودة: المحتوى واللغة والصورة.', 48, 'rule', 22),
  ('blog',     'publishing',      'النشر',                 'نشر المقال في ميعاده وربطه بالخطة.', 24, 'rule', 23),
  ('certificates', 'fulfilment',  'المتابعة',              NULL, 72,  'rule', 20),
  ('certificates', 'issue',       'إصدار الشهادة',         'المشارك خلّص جلسات الباقة: راجع الاسم واصدر الشهادة.', 48, 'rule', 21),
  ('certificates', 'print',       'الطباعة والتجهيز',      'ولي الأمر طلب نسخة ورقية: اطبع وجهّز للشحن.', 72, 'rule', 22),
  ('certificates', 'shipping',    'الشحن والتسليم',        'الشهادة في الشحن: تابع لحد ما توصل.', 120, 'rule', 23)
ON CONFLICT (line, step) DO NOTHING;

-- ── ٣) تذاكر الدعم ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_tasks_support_ticket_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  begin
    if new.status::text = 'open' then
      perform public.work_task_open('support', 'fulfilment', new.id::text, null,
        'تذكرة دعم — ' || left(coalesce(nullif(btrim(new.subject), ''), 'بدون عنوان'), 80),
        '/dashboard/admin/support/tickets/' || new.id::text, true, 'ticket');
    else
      perform public.work_task_close('support', 'fulfilment', new.id::text);
    end if;
  exception when others then
    -- المهمة مساعدة؛ فشلها مايوقفش التذكرة نفسها.
    raise warning 'work_tasks_support_ticket_fn: ticket % — %', new.id, sqlerrm;
  end;
  return new;
end;
$fn$;

DROP TRIGGER IF EXISTS work_tasks_support_ticket_trg ON public.support_tickets;
CREATE TRIGGER work_tasks_support_ticket_trg
  AFTER INSERT OR UPDATE OF status ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.work_tasks_support_ticket_fn();

-- رد العميل على تذكرة «اتردّ عليها» = الكرة رجعت للدعم.
CREATE OR REPLACE FUNCTION public.support_ticket_customer_reply_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  update support_tickets
     set status = 'open', updated_at = now()
   where id = new.ticket_id
     and user_id = new.sender_profile_id
     and status = 'answered';
  return new;
exception when others then
  raise warning 'support_ticket_customer_reply_fn: ticket % — %', new.ticket_id, sqlerrm;
  return new;
end;
$fn$;

DROP TRIGGER IF EXISTS support_ticket_customer_reply_trg ON public.support_ticket_messages;
CREATE TRIGGER support_ticket_customer_reply_trg
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_customer_reply_fn();

-- ── ٤) طلبات جلسة الدعم ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_tasks_session_request_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  begin
    if new.status::text = 'pending' then
      perform public.work_task_open('support', 'fulfilment', new.id::text, null,
        'طلب جلسة دعم — ' || left(coalesce(nullif(btrim(new.contact_name), ''), 'عميل'), 60),
        '/dashboard/admin/support/session-requests', true, 'session_request');
    else
      perform public.work_task_close('support', 'fulfilment', new.id::text);
    end if;
  exception when others then
    raise warning 'work_tasks_session_request_fn: request % — %', new.id, sqlerrm;
  end;
  return new;
end;
$fn$;

DROP TRIGGER IF EXISTS work_tasks_session_request_trg ON public.support_session_requests;
CREATE TRIGGER work_tasks_session_request_trg
  AFTER INSERT OR UPDATE OF status ON public.support_session_requests
  FOR EACH ROW EXECUTE FUNCTION public.work_tasks_session_request_fn();

-- ── ٥) طلبات الانضمام ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_tasks_join_step(p_request uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  select case when exists (
    select 1 from join_request_messages m where m.request_id = p_request and m.author::text = 'admin'
  ) then 'decision' else 'review' end
$fn$;

CREATE OR REPLACE FUNCTION public.work_tasks_join_request_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  begin
    if new.status::text = 'pending' then
      perform public.work_task_open('join', 'fulfilment', new.id::text, null,
        'طلب انضمام — ' || left(coalesce(nullif(btrim(new.applicant_name), ''), 'بدون اسم'), 60),
        '/dashboard/admin/join-requests/' || new.id::text, true, public.work_tasks_join_step(new.id));
    else
      perform public.work_task_close('join', 'fulfilment', new.id::text);
    end if;
  exception when others then
    raise warning 'work_tasks_join_request_fn: request % — %', new.id, sqlerrm;
  end;
  return new;
end;
$fn$;

DROP TRIGGER IF EXISTS work_tasks_join_request_trg ON public.join_requests;
CREATE TRIGGER work_tasks_join_request_trg
  AFTER INSERT OR UPDATE OF status ON public.join_requests
  FOR EACH ROW EXECUTE FUNCTION public.work_tasks_join_request_fn();

-- أول رسالة من الإدارة = اتواصلنا ← المهمة تنتقل لـ«القرار».
CREATE OR REPLACE FUNCTION public.work_tasks_join_message_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  r join_requests;
begin
  if new.author::text <> 'admin' then
    return new;
  end if;
  begin
    select * into r from join_requests where id = new.request_id;
    if found and r.status::text = 'pending' then
      perform public.work_task_open('join', 'fulfilment', r.id::text, null,
        'طلب انضمام — ' || left(coalesce(nullif(btrim(r.applicant_name), ''), 'بدون اسم'), 60),
        '/dashboard/admin/join-requests/' || r.id::text, true, 'decision');
    end if;
  exception when others then
    raise warning 'work_tasks_join_message_fn: request % — %', new.request_id, sqlerrm;
  end;
  return new;
end;
$fn$;

DROP TRIGGER IF EXISTS work_tasks_join_message_trg ON public.join_request_messages;
CREATE TRIGGER work_tasks_join_message_trg
  AFTER INSERT ON public.join_request_messages
  FOR EACH ROW EXECUTE FUNCTION public.work_tasks_join_message_fn();

-- ── ٦) قنوات التواصل: مهمة يومية لكل قناة ليها مسؤول ──────────────
CREATE OR REPLACE FUNCTION public.work_channels_daily()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  v_day    date := (now() at time zone 'Africa/Cairo')::date;
  v_label  text := to_char(v_day, 'YYYY-MM-DD');
  v_step   text;
  v_title  text;
  v_n      integer := 0;
begin
  foreach v_step in array array['whatsapp', 'email'] loop
    -- القناة مقفولة لحد ما يتحدد لها مسؤول (للقناة نفسها أو للمسار كله).
    continue when not exists (
      select 1 from assignment_rules r
       where r.line = 'channels' and r.stage in (v_step, 'fulfilment')
    );
    continue when exists (
      select 1 from work_tasks t
       where t.line = 'channels' and t.stage = 'fulfilment' and t.source_id = v_step || ':' || v_label
    );
    v_title := case v_step when 'whatsapp' then 'رسائل واتساب' else 'بريد المنصة' end || ' — ' || v_label;
    perform public.work_task_open('channels', 'fulfilment', v_step || ':' || v_label, v_label,
      v_title, '/dashboard/admin/tasks', true, v_step);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$fn$;

REVOKE ALL ON FUNCTION public.work_channels_daily() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_channels_daily() TO service_role;

-- فتح «مهامي» بيشغّل نفس الفحص (مرة كل ١٠ دقايق) — فالقنوات بتتفتح حتى لو الـcron اتأخر.
DO $mig$
DECLARE
  v_def text := pg_get_functiondef('public.work_tasks_sweep_if_due'::regproc);
  v_new text;
BEGIN
  IF position('channels_daily_v1' in v_def) > 0 THEN
    RAISE NOTICE 'work_tasks_sweep_if_due: already patched';
    RETURN;
  END IF;
  v_new := regexp_replace(
    v_def,
    $re$(perform public\.box_shipment_tasks_sync\(\);\s+exception when others then\s+raise warning 'work_tasks_sweep_if_due: box sync — %', sqlerrm;\s+end;)$re$,
    E'\\1\n  begin -- channels_daily_v1\n    perform public.work_channels_daily();\n  exception when others then\n    raise warning ''work_tasks_sweep_if_due: channels — %'', sqlerrm;\n  end;'
  );
  IF v_new = v_def THEN
    RAISE EXCEPTION 'work_tasks_sweep_if_due: النص المتوقَّع مش موجود — مفيش تغيير اتعمل';
  END IF;
  EXECUTE v_new;
END
$mig$;

-- ── ٧) المفتوح دلوقتي ياخد مهمته (مرة واحدة) ─────────────────────
DO $mig$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id, subject FROM support_tickets WHERE status::text = 'open' LOOP
    PERFORM public.work_task_open('support', 'fulfilment', r.id::text, null,
      'تذكرة دعم — ' || left(coalesce(nullif(btrim(r.subject), ''), 'بدون عنوان'), 80),
      '/dashboard/admin/support/tickets/' || r.id::text, false, 'ticket');
  END LOOP;
  FOR r IN SELECT id, contact_name FROM support_session_requests WHERE status::text = 'pending' LOOP
    PERFORM public.work_task_open('support', 'fulfilment', r.id::text, null,
      'طلب جلسة دعم — ' || left(coalesce(nullif(btrim(r.contact_name), ''), 'عميل'), 60),
      '/dashboard/admin/support/session-requests', false, 'session_request');
  END LOOP;
  FOR r IN SELECT id, applicant_name FROM join_requests WHERE status::text = 'pending' LOOP
    PERFORM public.work_task_open('join', 'fulfilment', r.id::text, null,
      'طلب انضمام — ' || left(coalesce(nullif(btrim(r.applicant_name), ''), 'بدون اسم'), 60),
      '/dashboard/admin/join-requests/' || r.id::text, false, public.work_tasks_join_step(r.id));
  END LOOP;
END
$mig$;
