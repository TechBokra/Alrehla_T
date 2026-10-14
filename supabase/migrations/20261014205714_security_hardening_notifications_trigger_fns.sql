-- ============================================================================
-- تشديد أمني قبل الإطلاق: الإشعارات + دوال المحفّزات
-- ============================================================================
-- الغرض   : ١) notify_admins / notify_user كانتا تقبلان أي رابط وأي طول من أي
--              مستخدم مسجّل — يعني مستخدم عادي كان يقدر يبعت للإدارة إشعارًا
--              برابط خارجي (تصيّد) أو بنص ضخم. دلوقتي: الرابط داخلي نسبي فقط
--              (يبدأ بـ "/" واحدة، بدون مسافات أو "\")، والعنوان ≤ 120 والنص ≤ 500
--              (بنقصّ الزائد ومابنرفضش — الإشعارات مش load-bearing)، والرابط
--              الغلط بيتحوّل NULL والإشعار نفسه بيوصل.
--           ٢) reset_due_notifications (دالة محفّز) من غير search_path ثابت.
--           ٣) دوال المحفّزات في public كانت قابلة للتنفيذ من PUBLIC/anon/authenticated
--              مع إنها مابتتنادى إلا كمحفّزات (صلاحية EXECUTE بتتفحص وقت CREATE TRIGGER
--              مش وقت التشغيل، فالمحفّزات الموجودة تفضل شغّالة).
-- الأثر   : لا تغيير في الجداول. دالتان تتعدّلان + دالة مساعدة جديدة.
-- ما لا يلمسه: دوال SECURITY DEFINER اللي سياسات RLS بتنادي عليها بدور anon
--           (is_admin, can_see_profile, ...) — سحب EXECUTE منها كان هيكسر القراءة
--           العامة. وprosecdef غير المحفّزات مابتتغيرش.
-- الترتيب : مستقل — ينفع قبل أو بعد باقي migrations هذا الإصدار.
-- التحقق  : انظر supabase/tests/security-hardening.sql (تُشغَّل داخل begin/rollback).
-- الرجوع  : أعد تعريف notify_admins / notify_user من
--           20261012173847_alrehla_staging_initial_schema_01.sql، واحذف is_internal_link،
--           و grant execute على دوال المحفّزات لـ public (غير مطلوب فعليًا للتشغيل).
-- ============================================================================

create or replace function public.is_internal_link(p_link text)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  -- NULL مسموح (إشعار بلا رابط). غير كده: "/" أو "/xxx" — مش "//xxx" ولا "/\xxx".
  select p_link is null
      or (char_length(p_link) <= 300 and p_link ~ '^/([^/\\\s][^\\\s]*)?$')
$$;

comment on function public.is_internal_link(text) is
  'هل الرابط مسار داخلي نسبي آمن للإشعارات؟ (يبدأ بـ / واحدة، بدون مسافات أو \\).';

create or replace function public.notify_admins(
  p_title text, p_message text default null, p_link text default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;

  IF length(trim(coalesce(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'notification needs a title';
  END IF;

  INSERT INTO notifications (recipient_profile_id, title, message, link)
  SELECT
    u.id::text,
    left(trim(p_title), 120),
    left(NULLIF(trim(coalesce(p_message, '')), ''), 500),
    CASE WHEN public.is_internal_link(p_link) THEN p_link ELSE NULL END
  FROM user_profiles u
  WHERE u.role IN ('super_admin', 'general_supervisor');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$function$;

create or replace function public.notify_user(
  p_recipient text, p_title text, p_message text default null, p_link text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF p_recipient IS NULL OR length(trim(coalesce(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'notification needs a recipient and a title';
  END IF;

  -- المسموح لهم بإرسال إشعار: الإدارة، أو طرف في طلب خدمة يجمعه
  -- بالمستلِم. و«طرف» = المشتري، أو مقدّم الخدمة أيًّا كان نوعه.
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM service_orders o
      LEFT JOIN instructors        i   ON i.id   = o.instructor_id
      LEFT JOIN service_providers  sp  ON sp.id  = o.provider_id
      LEFT JOIN instructors        spi ON spi.id = sp.instructor_id
      WHERE (
              o.buyer_profile_id = auth.uid()::text
              OR i.user_id   = auth.uid()
              OR sp.user_id  = auth.uid()
              OR spi.user_id = auth.uid()
            )
        AND (
              o.buyer_profile_id   = p_recipient
              OR i.user_id::text   = p_recipient
              OR sp.user_id::text  = p_recipient
              OR spi.user_id::text = p_recipient
            )
    )
  ) THEN
    RAISE EXCEPTION 'not allowed to notify this user';
  END IF;

  INSERT INTO notifications (recipient_profile_id, title, message, link)
  VALUES (
    p_recipient,
    left(trim(p_title), 120),
    left(NULLIF(trim(coalesce(p_message, '')), ''), 500),
    CASE WHEN public.is_internal_link(p_link) THEN p_link ELSE NULL END
  );
END
$function$;

-- ٢) search_path ثابت لدالة المحفّز.
alter function public.reset_due_notifications() set search_path = public;

-- ٣) دوال المحفّزات: لا تُنادى إلا كمحفّزات.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end
$$;
