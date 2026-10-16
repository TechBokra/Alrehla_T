-- ============================================================================
-- إلغاء الحجز من الإدارة — **كان مش موجود خالص**
-- ============================================================================
-- الاكتشاف : الإدارة **ماتقدرش تلغي حجز باقة**. كلمة «ملغي» موجودة في
--            الشاشة كتسمية لحالة، لكن مفيش ولا أكشن واحد في المشروع
--            بيحوّل اشتراك لـ`cancelled`. يعني الحجز المعلّق بيفضل
--            معلّقًا للأبد، ومفيش طريقة تشيله.
--
--            (وآلية الإلغاء التلقائي `cancel_stale_pending_orders`
--             بتشتغل على جدول `orders` وحده — «إنها لك». الحجوزات
--             وطلبات الخدمات برّه تغطيتها.)
--
-- الغرض    : إلغاء كامل، يسيب ورا نظيف.
--
-- ── إيه اللي بيحصل مع الإلغاء، وليه ─────────────────────────
--
--   ١) الاشتراك بيبقى `cancelled` وبيتكتب سبب الإلغاء.
--
--   ٢) **الجلسات اللي لسه ماحصلتش بتتلغي معاه.** ودي الحتة اللي
--      «بتعمل مشاكل» لو اتنست: الجلسات بتفضل في تقويم المدرب وفي
--      لوحة الطالب، وبتتبعت عنها تذكيرات، وبتتحسب في حصّة المدرب —
--      على حجز اتلغى.
--
--      ⚠️ **والجلسات المكتملة مابتتلمسش**: دي حصلت فعلًا، وتاريخ
--         المدرب والطالب مايتزوّرش عشان الحجز اتلغى بعدها.
--
--   ٣) كود الخصم بيترجع للعميل — محفّز `discount_release_courses_trg`
--      بيعمل ده لوحده مع التحويل لـ`cancelled`.
--
--   ٤) مهام الإدارة المفتوحة على الحجز بتتقفل — محفّز
--      `work_tasks_courses_trg` بيعمل ده لوحده كمان.
--
-- ⚠️ **المدفوع بيتلغي كمان، عن قصد.** في حالات حقيقية لازم فيها
--    إلغاء بعد الدفع (استرداد، اعتذار، خطأ). الدالة بترجّع إن الحجز
--    كان مدفوعًا عشان الشاشة تحذّر وتفكّر الإداري بالاسترداد — القرار
--    قراره، لكن مايتاخدش من غير ما يعرف.
--
-- الأمان   : `is_admin()` شرط، و`anon` ممنوع. والدالة **بتتأكد إن
--            الحالة بقت `cancelled` فعلًا** قبل ما تقول «تمّ» — حارس
--            الاشتراكات بيصحّح الصفوف في صمت، والنجاح الكاذب أسوأ من
--            الفشل.
--
-- التحقق   : شغّل التجربة اللي آخر الملف **قبل** الميجريشن — بتجرّب
--            كل حاجة جوّه معاملة بتتلغي، فمفيش صف بيتغيّر.
--
-- الرجوع   : drop function public.cancel_course_booking(text, text);
-- ============================================================================

create or replace function public.cancel_course_booking(
  p_id     text,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if v_status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'completed');
  end if;

  v_paid := v_status = 'active';

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
end $$;

revoke all on function public.cancel_course_booking(text, text) from public, anon;
grant execute on function public.cancel_course_booking(text, text) to authenticated;

comment on function public.cancel_course_booking(text, text) is
  'إلغاء حجز باقة من الإدارة: الاشتراك + الجلسات اللي لسه ماحصلتش. المكتمل مايتلغيش، والمدفوع بيتلغي مع تنبيه الشاشة للاسترداد.';


-- ============================================================================
-- تجربة قبل التشغيل — كله جوّه معاملة بتتلغي، مفيش صف بيتغيّر
-- ============================================================================
-- شغّلها **قبل** ما تشغّل الميجريشن فوق؟ لأ — الدالة لازم تتعمل الأول.
-- شغّل الميجريشن، وبعدين دي عشان تشوفها شغّالة قبل ما تلمس حجز حقيقي:
--
--   begin;
--   do $probe$
--   declare v_id text; v_st text; r jsonb; v_left int;
--   begin
--     select id::text, status into v_id, v_st
--       from course_subscriptions where status = 'pending'
--       order by created_at desc limit 1;
--     if v_id is null then raise exception 'RESULT: مفيش حجز معلّق'; end if;
--
--     r := public.cancel_course_booking(v_id, 'تجربة');
--
--     select count(*) into v_left from sessions
--      where course_subscription_id::text = v_id
--        and status in ('pending','scheduled','confirmed');
--
--     raise exception 'RESULT: قبل=% | النتيجة=% | جلسات فاضلة=%', v_st, r, v_left;
--   end $probe$;
--   rollback;
--
-- المتوقع: `ok: true`، و«جلسات فاضلة = 0».
-- ============================================================================
