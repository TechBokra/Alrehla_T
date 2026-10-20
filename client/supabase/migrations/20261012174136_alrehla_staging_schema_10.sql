-- ============================================================
-- 10 — حذف وتعليق الحسابات · أدوار الانضمام · التقييمات · آراء العملاء
-- ============================================================
--
-- ── ليه (ملاحظات تامر، والخطة اتوافق عليها) ─────────────────
--
-- ١) **طلبات الانضمام**: فورم «انضم لنا» بيعرض رسّام وتعليق صوتي وكاتب
--    و«أخرى»، والقاعدة كانت بتقبل مدرب وناشر بس — فأي حد يختار واحدة من
--    الباقي **طلبه بيترفض ومابيوصلش**. القيد بيتوسّع.
--
-- ٢) 🔴 **التقييمات مابتتحفظش خالص**: قيد «مشارك واحد» (طفل أو مشترك
--    مستقل) اتعمل لتقييم الجلسات — وتقييم الخدمة الإبداعية مالوش مشارك،
--    فكل تقييم بيترفض. القيد بقى للجلسات بس؛ تقييم الطلب (`service_order_id`)
--    مش محتاجه.
--
-- ٣) **حذف الحساب وتعليقه** (من شاشة المستخدمين، لمدير النظام):
--    • من غير أي حركات ← بيتمسح كله (هو وحسابات أطفاله).
--    • ليه حركات ← **أرشيف**: الدخول بيتقفل للأبد والحساب يختفي من
--      القايمة، وكل طلباته وفلوسه بتفضل زي ما هي.
--    • طلب الحذف كان بيتمسح مع الحساب (`ON DELETE CASCADE`) — يعني
--      **الدليل إن العميل طلب الحذف كان بيختفي مع الحذف نفسه**. الرابط
--      ده اتشال، والطلب بيفضل.
--
-- ٤) **آراء العملاء** (جدول جديد): ولي الأمر بيكتب رأيه في «إنها لك» لو
--    اشترى منها، وفي «بداية الرحلة» لو اشترك فيها — والرأي بيوصل لقسمه
--    في اللوحة. القاعدة هي اللي بتتأكد إنه استخدم الخط ده فعلًا.
--
-- ⚠️ **مفيش مسح لأي بيانات موجودة.** كله إضافة أو توسيع قيد.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 09. مرة واحدة في SQL Editor → Run. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'customer_feedback') THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'standalone_services'
       AND column_name = 'delivery_days'
  ) THEN
    RAISE EXCEPTION 'شغّل ملف 09 الأول.';
  END IF;
END
$$;

-- ── ١. أدوار الانضمام ────────────────────────────────────────
-- نفس القايمة اللي في الفورم (`src/lib/join-roles.ts`).

ALTER TABLE public.join_requests
  DROP CONSTRAINT join_requests_requested_role_check,
  ADD CONSTRAINT join_requests_requested_role_check CHECK (
    requested_role IN ('instructor', 'publisher', 'illustrator', 'voiceover', 'author', 'other')
  );

-- ── ٢. التقييمات ─────────────────────────────────────────────

ALTER TABLE public.reviews
  DROP CONSTRAINT chk_review_one_participant,
  ADD CONSTRAINT chk_review_one_participant CHECK (
    -- تقييم طلب خدمة: المشارك مش لازم (الطلب نفسه هو المرجع).
    service_order_id IS NOT NULL
    -- تقييم جلسة: مشارك واحد بالظبط، زي ما كان.
    OR (dependent_participant_id IS NOT NULL AND independent_participant_id IS NULL)
    OR (dependent_participant_id IS NULL AND independent_participant_id IS NOT NULL)
  );

-- ── ٣. طلبات الحذف بتفضل بعد الحذف ───────────────────────────

ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT account_deletion_requests_user_id_fkey;

-- ── ٣. الأرشيف ───────────────────────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_by uuid;

-- الحارس (آخر نسخة من ملف 05) + الأرشيف:
--   • العميل مايقدرش يلمس الأرشيف (زي الإيقاف).
--   • الإداري العادي كمان لا — الأرشيف قرار مدير النظام.
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
      -- الأرشيف (= حذف حساب له حركات) لمدير النظام بس — ملف 10.
      IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
         OR NEW.archived_by IS DISTINCT FROM OLD.archived_by THEN
        RAISE EXCEPTION 'حذف الحسابات لمدير النظام فقط'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      NEW.role          := OLD.role;
      NEW.admin_role_id := OLD.admin_role_id;

      -- الموقوف مايفكّش إيقاف نفسه (قاعدة «ب»)، ولا المؤرشف.
      NEW.suspended_at      := OLD.suspended_at;
      NEW.suspension_reason := OLD.suspension_reason;
      NEW.archived_at       := OLD.archived_at;
      NEW.archived_by       := OLD.archived_by;
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

-- ── ٣. «عليه حركات؟» ─────────────────────────────────────────
--
-- مكان واحد بيقرر — الشاشة بتعرضه، والحذف الكامل بيتأكد منه تاني
-- جوّه نفس العملية. أي جدول جديد فيه حركات للعميل **لازم يتضاف هنا**.
--
-- ⚠️ الأطفال محسوبين: اشتراك باسم طفل = حركة على ولي الأمر.

CREATE OR REPLACE FUNCTION public.account_activity(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v text := p_user::text;
  v_children text[];
  r jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(id::text), '{}') INTO v_children
    FROM child_profiles WHERE user_profile_id = p_user;

  r := jsonb_build_object(
    'orders',            (SELECT count(*) FROM orders WHERE user_id::text = v),
    'box_subscriptions', (SELECT count(*) FROM box_subscriptions WHERE user_id::text = v),
    'course_subscriptions', (SELECT count(*) FROM course_subscriptions
                              WHERE user_id::text = v OR child_id::text = ANY (v_children)),
    'service_orders',    (SELECT count(*) FROM service_orders WHERE buyer_profile_id::text = v),
    'reviews',           (SELECT count(*) FROM reviews
                           WHERE reviewer_profile_id::text = v
                              OR dependent_participant_id::text = ANY (v_children)),
    'support_tickets',   (SELECT count(*) FROM support_tickets WHERE user_id::text = v),
    'session_requests',  (SELECT count(*) FROM support_session_requests WHERE user_id::text = v),
    'feedback',          (SELECT count(*) FROM customer_feedback WHERE user_id::text = v),
    -- حساب شغل (مدرب/ناشر/مقدّم خدمة) = حركات حتى لو لسه مافيش طلبات.
    'work_profiles',     (SELECT count(*) FROM instructors WHERE user_id::text = v)
                       + (SELECT count(*) FROM publishers WHERE user_id::text = v)
                       + (SELECT count(*) FROM service_providers WHERE user_id::text = v)
  );

  RETURN r || jsonb_build_object(
    'total', (SELECT coalesce(sum(value::int), 0) FROM jsonb_each_text(r))
  );
END
$function$
;

-- ── ٣. الحذف الكامل (من غير حركات بس) ───────────────────────
--
-- بيمسح الملف الشخصي (والأطفال بالتبعية) وملفات حسابات الأطفال، وبيرجّع
-- أرقام حسابات الدخول اللي لازم تتمسح من Auth (الكود بيمسحها بمفتاح
-- الخادم — القاعدة ماتقدرش). الفحص هنا **جوّه نفس العملية**: لو حركة
-- اتعملت بين ما الشاشة اتفتحت والضغط على «احذف»، الحذف بيترفض.
--
-- ⚠️ بمفتاح الخادم بس (مش من المتصفح) — والكود بيتأكد إن اللي طالب
--    الحذف مدير النظام.

CREATE OR REPLACE FUNCTION public.admin_purge_account(p_user uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role user_role_enum;
  v_logins uuid[];
  v_activity jsonb;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM user_profiles WHERE id = p_user FOR UPDATE;
  IF v_role IN ('super_admin', 'general_supervisor') THEN
    RAISE EXCEPTION 'الحسابات الإدارية مابتتحذفش — غيّر دوره الأول';
  END IF;
  IF EXISTS (SELECT 1 FROM child_profiles WHERE account_profile_id = p_user::text) THEN
    RAISE EXCEPTION 'ده حساب طفل — بيتقفل من حساب ولي أمره';
  END IF;

  v_activity := public.account_activity(p_user);
  IF (v_activity->>'total')::int > 0 THEN
    RAISE EXCEPTION 'الحساب عليه حركات — بيتأرشف بدل ما يتمسح';
  END IF;

  SELECT coalesce(array_agg(account_profile_id::uuid), '{}') INTO v_logins
    FROM child_profiles
   WHERE user_profile_id = p_user AND account_profile_id IS NOT NULL;

  DELETE FROM notifications WHERE recipient_profile_id = p_user::text
                               OR recipient_profile_id = ANY (v_logins::text[]);
  DELETE FROM user_profiles WHERE id = ANY (v_logins);
  -- الأطفال وما يتبعهم بيتمسحوا بالتبعية (`ON DELETE CASCADE`).
  DELETE FROM user_profiles WHERE id = p_user;

  RETURN array_append(v_logins, p_user);
END
$function$
;

REVOKE ALL ON FUNCTION public.account_activity(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.account_activity(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_purge_account(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_account(uuid) TO service_role;

-- ── ٤. آراء العملاء ──────────────────────────────────────────

CREATE TABLE public.customer_feedback (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  line text NOT NULL,
  rating smallint NOT NULL,
  comment text,
  status text DEFAULT 'new' NOT NULL,
  admin_note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  handled_at timestamptz,
  handled_by uuid,
  CONSTRAINT customer_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT customer_feedback_line_check CHECK (line IN ('enha_lak', 'creative_writing')),
  CONSTRAINT customer_feedback_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT customer_feedback_comment_length CHECK (comment IS NULL OR char_length(comment) <= 2000),
  CONSTRAINT customer_feedback_status_check CHECK (status IN ('new', 'seen')),
  -- الرأي بيتمسح مع الحساب المحذوف بس — والحساب اللي عليه رأي
  -- مابيتمسحش أصلًا (محسوب حركة)، فعمليًا الرأي بيفضل.
  CONSTRAINT customer_feedback_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.user_profiles(id) ON DELETE CASCADE
);
CREATE INDEX customer_feedback_line_created_idx ON public.customer_feedback (line, created_at DESC);
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

-- «استخدم الخط ده؟» — حاجة اتدفعت فعلًا، مش طلب اتساب في النص.
CREATE OR REPLACE FUNCTION public.used_line(p_user uuid, p_line text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_line
    WHEN 'enha_lak' THEN
      EXISTS (SELECT 1 FROM orders WHERE user_id::text = p_user::text
                AND status IN ('paid', 'preparing', 'shipped', 'delivered'))
      OR EXISTS (SELECT 1 FROM box_subscriptions WHERE user_id::text = p_user::text)
    WHEN 'creative_writing' THEN
      EXISTS (SELECT 1 FROM course_subscriptions WHERE user_id::text = p_user::text
                AND status IN ('active', 'completed'))
      OR EXISTS (SELECT 1 FROM service_orders WHERE buyer_profile_id::text = p_user::text
                AND status IN ('paid', 'in_progress', 'delivered', 'completed'))
    ELSE false
  END
$function$
;
REVOKE ALL ON FUNCTION public.used_line(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.used_line(uuid, text) TO authenticated, service_role;

CREATE POLICY "Customers send feedback on lines they used" ON public.customer_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'new'
    AND admin_note IS NULL AND handled_at IS NULL AND handled_by IS NULL
    AND public.used_line(auth.uid(), line)
  );
CREATE POLICY "Customers read their own feedback" ON public.customer_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins manage feedback" ON public.customer_feedback
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.customer_feedback TO authenticated;
GRANT UPDATE, DELETE ON public.customer_feedback TO authenticated;
GRANT ALL ON public.customer_feedback TO service_role;

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم يطلع ٤ سطور كلها ✓.
SELECT 'أدوار الانضمام' AS "التعديل",
       CASE WHEN pg_get_constraintdef(oid) LIKE '%illustrator%' THEN '✓' ELSE '✗' END AS "تمام؟"
  FROM pg_constraint WHERE conname = 'join_requests_requested_role_check'
UNION ALL
SELECT 'التقييمات', CASE WHEN pg_get_constraintdef(oid) LIKE '%service_order_id%' THEN '✓' ELSE '✗' END
  FROM pg_constraint WHERE conname = 'chk_review_one_participant'
UNION ALL
SELECT 'أرشيف الحسابات', CASE WHEN count(*) = 2 THEN '✓' ELSE '✗' END
  FROM information_schema.columns
 WHERE table_name = 'user_profiles' AND column_name IN ('archived_at', 'archived_by')
UNION ALL
SELECT 'آراء العملاء', CASE WHEN count(*) = 3 THEN '✓' ELSE '✗' END
  FROM pg_policies WHERE tablename = 'customer_feedback';
