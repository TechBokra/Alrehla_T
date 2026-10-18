-- ═══════════════════════════════════════════════════════════════
-- حساب الشغل مايطلبش بنفس الحساب
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض
--   قرار تامر (١٨ أكتوبر): «عايز أفصل حساب مقدم الخدمة والمدرب
--   والإداري إنه يطلب طلب بنفس الحساب. لو حابب، يبقى يعمل حساب
--   منفصل».
--
--   الملف ده بيضيف الشرط للمحفّز الموجود `block_suspended_purchase`
--   اللي مربوط أصلًا على `orders` و`course_subscriptions` و
--   `service_orders` — نفس المكان اللي بيمنع الحساب الموقوف وحساب
--   الطفل التابع.
--
-- ليه في القاعدة ومش في الكود وحده
--   الكود فيه نفس الفحص (`@/lib/buying-roles`) وبيدّي رسالة عربية
--   مفهومة قبل ما الطلب يوصل لهنا. بس أكشن Next بيتنادى من غير
--   الشاشة (قاعدة «ع») — فالحارس اللي في الكود وحده بيتخطّى بنداء
--   مباشر. المحفّز هو اللي بيشتغل في الحالتين.
--
-- الأثر
--   • أي INSERT في التلات جداول دي من حساب دوره مش `customer` ولا
--     `student` بيترفض برسالة عربية.
--   • الطلبات الموجودة **مابتتغيّرش** — المحفّز BEFORE INSERT بس.
--   • ⚠️ **وده بيشمل حساب مدير النظام**: لو عايز تجرّب طلبًا بنفسك،
--     اعمل حساب عميل بإيميل تاني. ده المقصود من القرار، ومتعمّد.
--   • مفيش جدول اتغيّر، ومفيش صف اتمسح، ومفيش صلاحية اتسحبت.
--
-- الترتيب
--   مستقل. مابيعتمدش على أي ملف بعد `20261018…`، وبيعتمد على وجود
--   `block_suspended_purchase` (موجودة من ملف 118).
--
-- التحقق بعد التشغيل
--   1) الشرط موجود في نص الدالة:
--        select pg_get_functiondef(oid) ilike '%user_role_enum%'
--          from pg_proc where proname = 'block_suspended_purchase';
--      ← true
--
--   2) المحفّزات التلاتة لسه مربوطة:
--        select count(*) from pg_trigger
--         where not tgisinternal
--           and pg_get_triggerdef(oid) ilike '%block_suspended_purchase%';
--      ← 3
--
--   3) الطلبات القديمة ما اتأثرتش:
--        select count(*) from orders;   ← نفس الرقم قبل التشغيل
--
-- الرجوع للخلف
--   شيل الفقرة المعلَّمة بـ«دور الشغل» من الدالة وشغّل
--   CREATE OR REPLACE تاني. الدالة مابتعملش أي كتابة، فالرجوع آمن
--   في أي وقت ومالوش أثر على بيانات.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.block_suspended_purchase()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_owner uuid;
  v_role  public.user_role_enum;
BEGIN
  -- اسم عمود المالك بيتبعت وقت ربط المحفّز: orders.user_id،
  -- course_subscriptions.user_id، service_orders.buyer_profile_id.
  v_owner := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE id = v_owner AND suspended_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'الحساب ده موقوف عن الشراء. تواصل مع الإدارة.';
  END IF;

  -- ملف 11: حساب الطفل التابع بيطلب من ولي أمره، مايشتريش بنفسه.
  IF EXISTS (
    SELECT 1 FROM public.child_profiles
     WHERE account_profile_id = v_owner::text
  ) THEN
    RAISE EXCEPTION 'حساب الطالب مايشتريش مباشرة — اطلب من ولي أمرك.';
  END IF;

  -- ── دور الشغل (قرار تامر، ١٨ أكتوبر) ────────────────────────
  --
  -- ⚠️ **بالاستبعاد مش بقايمة منع**: لو اتضاف دور جديد في
  --    `user_role_enum` بكرة، قايمة المنع كانت هتسمح له بالشراء
  --    بالسكوت. كده الدور الجديد بيترفض لحد ما حد يضيفه هنا بقرار
  --    مكتوب.
  --
  -- ⚠️ والدور بيتقرا من `user_profiles` مش من الصف الجديد — اللي
  --    الشاشة بعتته مش دليل (قاعدة «ف»).
  SELECT role INTO v_role FROM public.user_profiles WHERE id = v_owner;

  IF v_role IS NOT NULL AND v_role NOT IN ('customer', 'student', 'visitor') THEN
    RAISE EXCEPTION
      'حساب % مايطلبش من نفس الحساب. اعمل حساب عميل بإيميل تاني وهتقدر تطلب عادي.',
      CASE v_role
        WHEN 'instructor'         THEN 'المدرب'
        WHEN 'service_provider'   THEN 'مقدّم الخدمة'
        WHEN 'publisher'          THEN 'دار النشر'
        WHEN 'general_supervisor' THEN 'الإداري'
        WHEN 'super_admin'        THEN 'مدير النظام'
        ELSE 'الشغل'
      END;
  END IF;

  RETURN NEW;
END
$function$;

comment on function public.block_suspended_purchase() is
  'BEFORE INSERT على orders/course_subscriptions/service_orders: بيمنع الحساب الموقوف، وحساب الطفل التابع، وحسابات الشغل (مدرب/مقدّم خدمة/إداري). نفس الفحص في @/lib/buying-roles عشان الرسالة توصل قبل القاعدة.';
