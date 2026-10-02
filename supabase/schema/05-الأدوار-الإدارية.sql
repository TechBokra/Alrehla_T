-- ============================================================
-- 05 — الأدوار الإدارية بأسماء (محاسب، مسؤول محتوى، مسؤول طلبات…)
-- ============================================================
--
-- ── قبل الملف ده ─────────────────────────────────────────────
--
-- ملف 04 خلّى الصلاحيات للدور — بس كان فيه دور إداري واحد يتظبط:
-- «مشرف عام». يعني كل الإداريين غير مدير النظام بياخدوا نفس الحاجة.
--
-- ── بعده ─────────────────────────────────────────────────────
--
-- جدول `admin_roles`: **أدوار إدارية بأسماء**، كل واحد بصلاحياته.
-- البداية أربعة: «مشرف عام» (الافتراضي — نفس صلاحياته من ملف 04)،
-- و«محاسب»، و«مسؤول محتوى»، و«مسؤول طلبات». ومدير النظام يقدر يضيف
-- غيرهم أو يغيّر أسماءهم وصلاحياتهم من الشاشة — من غير ملفات جديدة.
--
-- • الشخص في القاعدة لسه دوره `general_supervisor` («إداري»)، وعمود
--   جديد `admin_role_id` بيقول أنهي دور إداري بالظبط. فاضي = الافتراضي.
-- • تغيير الدور الإداري لشخص = **لمدير النظام وحده** (الحارس). من غيره
--   «مسؤول المحتوى» كان يقدر يحوّل نفسه «محاسب» بنداء واحد.
-- • الدور الافتراضي مايتمسحش. ومسح أي دور تاني بيرجّع أصحابه للافتراضي.
-- • جدول `role_permissions` (ملف 04) **اتشال** — الافتراضي هنا مكانه.
--
-- ⚠️ **حدّ معروف (مش جديد):** الصلاحيات دي بتتحكم في **لوحة الإدارة**
--    (الأقسام اللي بتظهر وقدرة الشاشة تعدّل). على مستوى القاعدة نفسها،
--    أي حساب إداري لسه بيعدّي سياسات `is_admin()` — زي ما المشرف العام
--    كان من الأول. يعني الحماية من الغلط والتنظيم، مش من موظف بيقصد
--    يتلاعب بالقاعدة مباشرة. قفل ده على مستوى كل جدول مشروع لوحده.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 04. مرة واحدة في SQL Editor → Run. وحدة واحدة: يا يتنفّذ كله
-- يا ولا حاجة. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.admin_roles') IS NOT NULL THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF to_regclass('public.role_permissions') IS NULL THEN
    RAISE EXCEPTION 'شغّل ملف 04 الأول.';
  END IF;
END
$$;

-- ── ١. الجدول ───────────────────────────────────────────────

CREATE TABLE public.admin_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  CONSTRAINT admin_roles_name_length
    CHECK (char_length(btrim(name)) BETWEEN 2 AND 40),

  -- نفس قايمة الصلاحيات اللي في الكود — مفيش اسم غريب يدخل.
  CONSTRAINT admin_roles_known_permissions
    CHECK (permissions <@ ARRAY[
      'canManageUsers', 'canManageInstructors', 'canManagePublishers',
      'canManageCatalog', 'canManageSubscriptions', 'canManageOrders',
      'canManageBookings', 'canManageSupport', 'canManageContent',
      'canManageFinance', 'canViewAuditLogs'
    ]::text[])
);

-- اسمين بنفس الكلام (حتى لو بمسافات أو حروف كبيرة مختلفة) = لخبطة.
CREATE UNIQUE INDEX admin_roles_name_unique
  ON public.admin_roles (lower(btrim(name)));

-- افتراضي واحد بس.
CREATE UNIQUE INDEX admin_roles_one_default
  ON public.admin_roles (is_default) WHERE is_default;

-- الافتراضي = صلاحيات «مشرف عام» زي ما اتظبطت في 04.
INSERT INTO public.admin_roles (name, permissions, is_default, updated_by)
SELECT 'مشرف عام', permissions, true, updated_by
  FROM public.role_permissions
 WHERE role = 'general_supervisor';

-- لو صف 04 مش موجود لأي سبب، الافتراضي بالصلاحيات القديمة.
INSERT INTO public.admin_roles (name, permissions, is_default)
SELECT 'مشرف عام', ARRAY[
    'canManageUsers', 'canManageInstructors', 'canManagePublishers',
    'canManageCatalog', 'canManageSubscriptions', 'canManageOrders',
    'canManageBookings', 'canManageSupport', 'canManageContent'
  ]::text[], true
 WHERE NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE is_default);

INSERT INTO public.admin_roles (name, permissions) VALUES
  ('محاسب',        ARRAY['canManageFinance', 'canViewAuditLogs']::text[]),
  ('مسؤول محتوى',  ARRAY['canManageContent']::text[]),
  ('مسؤول طلبات',  ARRAY['canManageOrders', 'canManageSubscriptions']::text[]);

-- ── ٢. حماية الافتراضي ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_admin_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_default THEN
      RAISE EXCEPTION 'الدور الافتراضي مايتمسحش' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.is_default IS DISTINCT FROM OLD.is_default THEN
    RAISE EXCEPTION 'الدور الافتراضي مابيتغيّرش' USING ERRCODE = '42501';
  END IF;
  NEW.name := btrim(NEW.name);
  RETURN NEW;
END
$function$
;

CREATE TRIGGER guard_admin_roles_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_roles();

REVOKE ALL ON FUNCTION public.guard_admin_roles FROM public, anon, authenticated;

-- ── ٣. الصلاحيات على الجدول ─────────────────────────────────

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read admin roles" ON public.admin_roles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Super admin adds admin roles" ON public.admin_roles
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() AND NOT is_default);

CREATE POLICY "Super admin edits admin roles" ON public.admin_roles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin deletes admin roles" ON public.admin_roles
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_super_admin());

REVOKE ALL ON public.admin_roles FROM anon;
REVOKE TRUNCATE ON public.admin_roles FROM authenticated;

-- ── ٤. عمود الشخص ───────────────────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN admin_role_id uuid
  REFERENCES public.admin_roles(id) ON DELETE SET NULL;

-- ── ٥. الحارس ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_user_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() فاضي = التعديل جاي من السيرفر (service role)، مش من متصفح.
  -- ومدير النظام بيعدّي كل حاجة.
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    IF public.is_admin() THEN
      -- الإداري: الأدوار العادية بس (ملف 04).
      IF NEW.role IS DISTINCT FROM OLD.role
         AND (OLD.role IN ('super_admin', 'general_supervisor')
              OR NEW.role IN ('super_admin', 'general_supervisor')) THEN
        RAISE EXCEPTION 'تغيير الأدوار الإدارية لمدير النظام فقط'
          USING ERRCODE = '42501';
      END IF;
      -- ⚠️ **والدور الإداري كمان** — من غيره مسؤول المحتوى يحوّل نفسه
      --    محاسب بنداء واحد.
      IF NEW.admin_role_id IS DISTINCT FROM OLD.admin_role_id THEN
        RAISE EXCEPTION 'تغيير الدور الإداري لمدير النظام فقط'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      NEW.role          := OLD.role;
      NEW.admin_role_id := OLD.admin_role_id;

      -- الموقوف مايفكّش إيقاف نفسه (قاعدة «ب»).
      NEW.suspended_at      := OLD.suspended_at;
      NEW.suspension_reason := OLD.suspension_reason;
    END IF;
  END IF;

  -- اللي مابقاش إداري مالوش دور إداري — عشان لو رجع، يرجع للافتراضي
  -- مش لدور قديم محدش فاكره.
  IF NEW.role IS DISTINCT FROM 'general_supervisor' THEN
    NEW.admin_role_id := NULL;
  END IF;

  RETURN NEW;
END
$function$
;

-- ── ٦. جدول 04 ──────────────────────────────────────────────

DROP TABLE public.role_permissions;

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم يطلع ٤ سطور: «مشرف عام» (افتراضي ✓) والتلاتة الجداد.
SELECT r.name                                   AS "الدور",
       CASE WHEN r.is_default THEN '✓' ELSE '' END AS "افتراضي",
       cardinality(r.permissions)               AS "عدد الصلاحيات",
       (SELECT count(*) FROM public.user_profiles p
         WHERE p.role = 'general_supervisor'
           AND (p.admin_role_id = r.id OR (p.admin_role_id IS NULL AND r.is_default))
       )                                        AS "عدد الأشخاص"
  FROM public.admin_roles r
 ORDER BY r.is_default DESC, r.name;
