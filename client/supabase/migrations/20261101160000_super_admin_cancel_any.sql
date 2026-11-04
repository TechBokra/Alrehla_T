-- ═══════════════════════════════════════════════════════════════
-- إلغاء أي طلب حتى لو مدفوع — للمدير العام (super_admin) بس
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — طلب تامر (١ نوفمبر): «تضيف للمدير العام (فقط) إمكانية إلغاء أي
-- طلب حتى لو كان مدفوع».
--
--   • طلبات المنتجات (orders): إلغاء طلب مدفوع أو بعده (paid/preparing/
--     shipped) **وكمان delivered** = مدير عام بس. قبل الدفع زي ما هو.
--   • طلبات الخدمات (service_orders): إلغاء/استرجاع طلب مدفوع أو بعده
--     (حتى «مكتمل») = مدير عام بس.
--   • الحجوزات (course_subscriptions): إلغاء حجز مفعّل أو مكتمل = مدير عام بس.
--
-- ⚠️ الإلغاء مابيرجّعش فلوس لوحده — الاسترداد بيتعمل من لوحة XPay (أو
--    التحويل) وبيتسجّل في سبب الإلغاء.
-- ⚠️ النداءات الداخلية (من غير مستخدم، auth.uid() فاضي) مش متقيّدة.
--
-- الأثر: تعديل ٣ دوال. مفيش بيانات بتتغيّر.
-- الترتيب: بعد كل ملفات ١ نوفمبر اللي قبله (مستقل عنها).
-- التحقق:
--   select prosrc ilike '%super_admin_cancel%' from pg_proc
--    where proname in ('validate_order_state_transition','guard_service_order_fields','cancel_course_booking');
--   ← true × 3
-- الرجوع: نفس الـreplace بالعكس (كل سطر مضاف عليه تعليق super_admin_cancel)،
--   أو إعادة تعريف الدوال من آخر ملف عرّفها.
-- ═══════════════════════════════════════════════════════════════

-- ── ١) طلبات المنتجات ─────────────────────────────────────────
do $$
declare
  v_def text;
  v_old1 text := 'WHEN ''shipped'' THEN NEW.status IN (''delivered'', ''cancelled'')';
  v_new1 text := 'WHEN ''shipped'' THEN NEW.status IN (''delivered'', ''cancelled'')
      WHEN ''delivered'' THEN NEW.status = ''cancelled'' AND public.is_super_admin() -- super_admin_cancel';
  v_old2 text := 'IF NEW.status = ''cancelled'' AND OLD.status IS DISTINCT FROM ''cancelled''';
  v_new2 text := '-- super_admin_cancel: إلغاء طلب مدفوع أو بعده للمدير العام بس.
  IF NEW.status = ''cancelled'' AND OLD.status IN (''paid'', ''preparing'', ''shipped'', ''delivered'')
     AND auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION ''إلغاء طلب مدفوع متاح للمدير العام بس'' USING ERRCODE = ''42501'';
  END IF;

  IF NEW.status = ''cancelled'' AND OLD.status IS DISTINCT FROM ''cancelled''';
begin
  select pg_get_functiondef('public.validate_order_state_transition'::regproc) into v_def;
  if position('super_admin_cancel' in v_def) > 0 then
    raise notice 'validate_order_state_transition: already patched';
  elsif position(v_old1 in v_def) = 0 or position(v_old2 in v_def) = 0 then
    raise exception 'validate_order_state_transition: النص المتوقع مش موجود — مااتعدّلش';
  else
    execute replace(replace(v_def, v_old1, v_new1), v_old2, v_new2);
  end if;
end $$;

-- ── ٢) طلبات الخدمات ──────────────────────────────────────────
do $$
declare
  v_def text;
  v_old text := 'IF auth.uid() IS NULL OR public.is_admin() THEN';
  v_new text := '-- super_admin_cancel: إلغاء/استرجاع طلب مدفوع أو بعده للمدير العام بس.
  IF TG_OP = ''UPDATE'' AND auth.uid() IS NOT NULL
     AND NEW.status IN (''cancelled'', ''refunded'') AND NEW.status IS DISTINCT FROM OLD.status
     AND OLD.status IN (''paid'', ''in_progress'', ''delivered'', ''completed'')
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION ''إلغاء أو استرجاع طلب مدفوع متاح للمدير العام بس'' USING ERRCODE = ''42501'';
  END IF;

  IF auth.uid() IS NULL OR public.is_admin() THEN';
begin
  select pg_get_functiondef('public.guard_service_order_fields'::regproc) into v_def;
  if position('super_admin_cancel' in v_def) > 0 then
    raise notice 'guard_service_order_fields: already patched';
  elsif position(v_old in v_def) = 0 then
    raise exception 'guard_service_order_fields: النص المتوقع مش موجود — مااتعدّلش';
  else
    execute replace(v_def, v_old, v_new);
  end if;
end $$;

-- ── ٣) الحجوزات ───────────────────────────────────────────────
create or replace function public.cancel_course_booking(p_id text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status   text;
  v_user     uuid;
  v_paid     boolean;
  v_after    text;
  v_sessions integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'denied');
  end if;

  -- ⚠️ `id` في الجدول ده نوعه `text` مش `uuid` — المقارنة نصّية.
  select status, user_id into v_status, v_user
    from course_subscriptions
   where id::text = p_id
     for update;

  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'already_cancelled');
  end if;
  -- super_admin_cancel: المفعّل والمكتمل للمدير العام بس.
  if v_status in ('active', 'completed') and not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'error', 'super_admin_only');
  end if;

  v_paid := v_status in ('active', 'completed');

  update course_subscriptions
     set status = 'cancelled'
   where id::text = p_id;

  -- التأكد إن الحارس ما رجّعش التغيير في صمت.
  select status into v_after from course_subscriptions where id::text = p_id;
  if v_after <> 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'blocked', 'status', v_after);
  end if;

  -- الجلسات اللي لسه ماحصلتش بس. المكتملة تاريخ، مايتلمسش.
  update sessions
     set status = 'cancelled'
   where course_subscription_id::text = p_id
     and status in ('pending', 'scheduled', 'confirmed');
  get diagnostics v_sessions = row_count;

  return jsonb_build_object(
    'ok', true,
    'wasPaid', v_paid,
    'sessionsCancelled', v_sessions,
    'userId', v_user,
    'reason', nullif(btrim(coalesce(p_reason, '')), '')
  );
end $function$;
