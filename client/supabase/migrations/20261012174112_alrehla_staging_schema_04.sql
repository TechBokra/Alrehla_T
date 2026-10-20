-- ============================================================
-- 04 — الصلاحيات على مستوى الدور
-- ============================================================
--
-- ── قبل الملف ده ─────────────────────────────────────────────
--
-- الصلاحيات كانت **لكل شخص**: عمود `permissions` في صفّ كل مستخدم.
-- يعني لو عندك ٣ مشرفين وعايز تشيل «المالية» منهم، تعدّل ٣ مرات —
-- والمشرف الجديد بياخد الافتراضي المكتوب في الكود، مش اللي إنت ظبطته.
--
-- ── بعده ─────────────────────────────────────────────────────
--
-- جدول صغير `role_permissions`: **صفّ لكل دور، فيه صلاحياته**. أي حد
-- دوره «مشرف عام» بياخد اللي في صفّ «مشرف عام» — اللي موجود دلوقتي
-- واللي هيتضاف بكره. وعمود الشخص اتشال.
--
-- • «مدير النظام» **مالوش صف** عن قصد: دايمًا كل الصلاحيات. لو كان
--   ينفع يتشال منه حاجة، ممكن يقفل الباب على نفسه ومحدش يفتحه.
-- • التعديل على الجدول **لمدير النظام بس** — من القاعدة نفسها، مش من
--   الشاشة بس.
--
-- ── 🔴 وثغرة اتقفلت معاه ─────────────────────────────────────
--
-- الحارس `guard_user_profile_fields` كان بيعدّي **أي إداري** من غير
-- فحص. يعني المشرف العام كان يقدر، بنداء واحد من متصفحه من غير
-- الشاشة، يغيّر دوره هو لـ«مدير نظام» — أو يدّي نفسه صلاحية المالية.
-- الشاشة كانت بتمنعه، والقاعدة لأ.
--
-- دلوقتي: **تغيير أي دور إداري (منه أو ليه) لمدير النظام وحده**.
-- المشرف العام لسه بيقدر يغيّر الأدوار العادية (عميل، ناشر، طالب…).
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- مرة واحدة في Supabase → SQL Editor → Run. الملف كله وحدة واحدة: يا
-- يتنفّذ كله يا مايتنفّذش منه حاجة. ولو اتشغّل مرة تانية بيقف من أوله
-- من غير ما يغيّر حاجة.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.role_permissions') IS NOT NULL THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
END
$$;

-- ── ١. الجدول ───────────────────────────────────────────────

CREATE TABLE public.role_permissions (
  role        public.user_role_enum PRIMARY KEY,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  -- الأدوار اللي ليها صلاحيات تتظبط. «مدير النظام» مش هنا عن قصد.
  CONSTRAINT role_permissions_editable_role
    CHECK (role IN ('general_supervisor')),

  -- مفيش اسم صلاحية غريب يدخل — نفس القايمة اللي في الكود.
  CONSTRAINT role_permissions_known_names
    CHECK (permissions <@ ARRAY[
      'canManageUsers', 'canManageInstructors', 'canManagePublishers',
      'canManageCatalog', 'canManageSubscriptions', 'canManageOrders',
      'canManageBookings', 'canManageSupport', 'canManageContent',
      'canManageFinance', 'canViewAuditLogs'
    ]::text[])
);

-- البداية = نفس اللي كان شغّال: كل حاجة ما عدا المالية والسجلات.
INSERT INTO public.role_permissions (role, permissions) VALUES
  ('general_supervisor', ARRAY[
    'canManageUsers', 'canManageInstructors', 'canManagePublishers',
    'canManageCatalog', 'canManageSubscriptions', 'canManageOrders',
    'canManageBookings', 'canManageSupport', 'canManageContent'
  ]::text[]);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- القراءة لأي إداري: كل مشرف محتاج يعرف صلاحياته عشان قايمته تتبني.
CREATE POLICY "Admins read role permissions" ON public.role_permissions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

-- الكتابة لمدير النظام وحده. ومفيش سياسة حذف — الصف بيتعدّل، مابيتمسحش.
CREATE POLICY "Super admin edits role permissions" ON public.role_permissions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin adds role permissions" ON public.role_permissions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

REVOKE ALL ON public.role_permissions FROM anon;
REVOKE DELETE, TRUNCATE ON public.role_permissions FROM authenticated;

-- ── ٢. الحارس — قفل الثغرة ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_user_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() فاضي = التعديل جاي من السيرفر (service role)، مش من متصفح.
  -- ومدير النظام بيعدّي كل حاجة.
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- ⚠️ **المشرف العام: الأدوار العادية بس.** قبل كده كان بيعدّي من
  --    غير فحص، فكان يقدر يرقّي نفسه لمدير نظام بنداء واحد.
  IF public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND (OLD.role IN ('super_admin', 'general_supervisor')
            OR NEW.role IN ('super_admin', 'general_supervisor')) THEN
      RAISE EXCEPTION 'تغيير الأدوار الإدارية لمدير النظام فقط'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  NEW.role := OLD.role;

  -- الموقوف مايفكّش إيقاف نفسه — سياسة «المستخدم يعدّل صفّه» بتسمح
  -- بالصف، والصلاحيات مابتحرسش الأعمدة (قاعدة «ب»).
  NEW.suspended_at      := OLD.suspended_at;
  NEW.suspension_reason := OLD.suspension_reason;

  RETURN NEW;
END
$function$
;

-- ── ٣. عمود الشخص ───────────────────────────────────────────
-- الحارس الجديد مابقاش بيلمسه، فبيتشال بأمان.

ALTER TABLE public.user_profiles DROP COLUMN permissions;

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم يطلع سطر واحد: general_supervisor و 9 صلاحيات،
-- و«عمود الشخص» = اتشال.
SELECT r.role,
       cardinality(r.permissions) AS "عدد الصلاحيات",
       (SELECT count(*) FROM public.user_profiles WHERE role = r.role) AS "عدد الأشخاص في الدور",
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'user_profiles'
            AND column_name = 'permissions'
       ) THEN 'لسه موجود ❌' ELSE 'اتشال ✓' END AS "عمود الشخص"
  FROM public.role_permissions r;
