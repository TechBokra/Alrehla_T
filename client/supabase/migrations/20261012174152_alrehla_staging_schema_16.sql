-- ============================================================
-- 16 — تصليحات اختبار لوحة الإدارة (shimaa) + قرارات تامر
-- ============================================================
--
-- ── اللي في الملف ده ────────────────────────────────────────
--
-- ١) تعديل الناشر على منتج معروض مابيشيلوش من الموقع (#GRXN)
--    كان التعديل بيتكتب فوق المنتج نفسه ويرجّعه «في الانتظار» —
--    فبيختفي من الموقع أول ما الناشر يحفظ، ولو الإدارة رفضت النسخة
--    القديمة تكون ضاعت. دلوقتي التعديل بيتحفظ «مسودة» جنب المنتج
--    (`pending_changes`) والمعروض بيفضل زي ما هو لحد الموافقة.
--
-- ٢) المدربين المفعّلين بيتفعّلوا كمقدّمي خدمة كمان (#SGCB)
--    صف «مقدّم الخدمة» بيتعمل مع المدرب «مستني» وماكانش بيتفعّل معاه،
--    فعروضه المعتمدة كانت بتظهر «قريبًا». (الموقع بيظبطها من النهارده؛
--    هنا تصليح اللي فات.) ومدرب كان «مقدّم فرد» قبل كده واتعمل له
--    صفّين (#6BJL): لو صف المدرب فاضي، بيتشال والقديم بيتحوّل له.
--
-- ٣) حساب الطفل يقدر يدخل غرفة جلسته (5.3)
--    ولي الأمر والمدرب كانوا يقدروا يقروا الجلسة، والطفل لأ — فزرار
--    «ادخل الجلسة» الجديد كان هيقوله «مش من حقك».
--
-- ٤) الطفل يطلب قصة وولي الأمر يدفع (#ATWG — قرار تامر)
--    نوع طلب جديد «منتج» في طلبات الأبناء. الحماية زي ما هي: الطفل
--    مابيشتريش، ولي الأمر بيوافق ويكمّل الطلب من حسابه.
--
-- ٥) طلب تغيير موعد جلسة (#LQMO — قرار تامر)
--    جدول جديد: ولي الأمر أو المدرب (أو الطالب) يطلب موعد تاني بسبب،
--    والإدارة توافق (الموعد يتغيّر والطرفين يوصلهم إشعار) أو ترفض.
--
-- ⚠️ **مفيش مسح لبيانات حد** — غير صف «مقدّم خدمة» فاضي (من غير عروض
--    ولا طلبات) لمدرب عنده صف تاني فيه شغله.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 15. في SQL Editor → Run. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.session_change_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_instructor_avatar_trg') THEN
    RAISE EXCEPTION 'شغّل ملف 15 الأول.';
  END IF;
END
$$;

-- ══ ١. مسودة تعديل الناشر ═══════════════════════════════════

ALTER TABLE public.personalized_products ADD COLUMN pending_changes jsonb;

COMMENT ON COLUMN public.personalized_products.pending_changes IS
  'تعديل ناشر على منتج معتمد، مستني الإدارة (ملف 16). المعروض بيفضل زي ما هو لحد الموافقة.';

-- نفس دالة ملف 06 + فرع «المنتج معتمد».
CREATE OR REPLACE FUNCTION public.guard_product_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new jsonb;
  v_old jsonb;
BEGIN
  -- فاضية = مفتاح الخدمة · والإداري هو المُوافِق.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    IF TG_OP = 'UPDATE'
       AND NEW.review_status = 'approved'
       AND OLD.review_status IS DISTINCT FROM 'approved' THEN
      NEW.reviewed_at := now();
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.review_status   := 'pending';
    NEW.review_note     := NULL;
    NEW.reviewed_at     := NULL;
    NEW.sort_order      := 0;
    NEW.pending_changes := NULL;
    NEW.updated_at      := now();
    RETURN NEW;
  END IF;

  -- وحاجات مش بتاعته أصلًا — في الحالتين.
  NEW.owner_type    := OLD.owner_type;
  NEW.publisher_id  := OLD.publisher_id;
  NEW.is_active     := OLD.is_active;
  NEW.slug          := OLD.slug;
  NEW.sort_order    := OLD.sort_order;
  NEW.updated_at    := now();

  -- ══ ⭐ ملف 16: المنتج معتمد ومعروض ════════════════════
  --
  -- التعديل بيروح «مسودة»، والمحتوى المعروض بيرجع زي ما كان. الموافقة
  -- (من الموقع، بحساب إداري) بتنقل المسودة للمنتج؛ الرفض بيمسحها بس.
  --
  -- ⚠️ القايمة دي = كل خانات المحتوى اللي الناشر بيعدّلها. خانة
  --    مش في القايمة كانت هتتعدّل على المعروض من غير مراجعة — فأي
  --    خانة محتوى جديدة على الجدول لازم تتضاف هنا.
  IF OLD.review_status = 'approved' THEN
    v_new := jsonb_build_object(
      'name', NEW.name, 'category', NEW.category, 'price', NEW.price,
      'electronic_price', NEW.electronic_price, 'publisher_cost', NEW.publisher_cost,
      'short_description', NEW.short_description, 'long_description', NEW.long_description,
      'cover_image_url', NEW.cover_image_url, 'gallery_image_urls', NEW.gallery_image_urls,
      'features', NEW.features, 'min_age', NEW.min_age, 'max_age', NEW.max_age);
    v_old := jsonb_build_object(
      'name', OLD.name, 'category', OLD.category, 'price', OLD.price,
      'electronic_price', OLD.electronic_price, 'publisher_cost', OLD.publisher_cost,
      'short_description', OLD.short_description, 'long_description', OLD.long_description,
      'cover_image_url', OLD.cover_image_url, 'gallery_image_urls', OLD.gallery_image_urls,
      'features', OLD.features, 'min_age', OLD.min_age, 'max_age', OLD.max_age);

    -- رجع للمعروض بالظبط = مفيش مسودة.
    NEW.pending_changes := CASE WHEN v_new = v_old THEN NULL ELSE v_new END;

    NEW.name               := OLD.name;
    NEW.category           := OLD.category;
    NEW.price              := OLD.price;
    NEW.electronic_price   := OLD.electronic_price;
    NEW.publisher_cost     := OLD.publisher_cost;
    NEW.short_description  := OLD.short_description;
    NEW.long_description   := OLD.long_description;
    NEW.cover_image_url    := OLD.cover_image_url;
    NEW.gallery_image_urls := OLD.gallery_image_urls;
    NEW.features           := OLD.features;
    NEW.min_age            := OLD.min_age;
    NEW.max_age            := OLD.max_age;

    NEW.review_status := 'approved';
    NEW.review_note   := OLD.review_note;
    NEW.reviewed_at   := OLD.reviewed_at;
    RETURN NEW;
  END IF;

  -- ══ لسه مااتعتمدش (مستني / مرفوض): زي ما كان ═══════════
  NEW.review_status   := 'pending';
  NEW.review_note     := OLD.review_note;
  NEW.reviewed_at     := OLD.reviewed_at;
  NEW.pending_changes := NULL;
  RETURN NEW;
END
$function$
;

-- ══ ٢. مقدّمو الخدمة للمدربين ═══════════════════════════════

-- (أ) صفّين لنفس الشخص: صف المدرب فاضي ← يتشال، والقديم يتحوّل له.
DELETE FROM public.service_providers dup
 USING public.instructors i, public.service_providers ind
 WHERE dup.kind = 'instructor'
   AND dup.instructor_id = i.id
   AND ind.kind = 'individual'
   AND ind.user_id = i.user_id
   AND NOT EXISTS (SELECT 1 FROM public.provider_services ps WHERE ps.provider_id = dup.id)
   AND NOT EXISTS (SELECT 1 FROM public.service_orders so WHERE so.provider_id = dup.id);

UPDATE public.service_providers ind
   SET kind = 'instructor', instructor_id = i.id, updated_at = now()
  FROM public.instructors i
 WHERE ind.kind = 'individual'
   AND ind.user_id = i.user_id
   AND NOT EXISTS (SELECT 1 FROM public.service_providers x WHERE x.instructor_id = i.id);

-- (ب) الحالة بتمشي مع المدرب.
UPDATE public.service_providers sp
   SET status = CASE i.status WHEN 'active' THEN 'active'::provider_status
                              WHEN 'suspended' THEN 'suspended'::provider_status
                              ELSE 'pending'::provider_status END,
       updated_at = now()
  FROM public.instructors i
 WHERE sp.instructor_id = i.id
   AND i.status IN ('active', 'suspended')
   AND sp.status::text IS DISTINCT FROM i.status::text;

-- ══ ٣. الطفل يقرا جلساته ════════════════════════════════════

-- ⚠️ بدالة `SECURITY DEFINER`: الطفل مابيقراش اشتراك ولي أمره
--    (`course_subscriptions` بتاعة ولي الأمر) — فالشرط جوّه السياسة
--    كان هيرجع «لأ» دايمًا. الدالة بترجّع نعم/لأ بس، مابتكشفش حاجة.
CREATE FUNCTION public.is_my_child_subscription(p_subscription_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.course_subscriptions cs
      JOIN public.child_profiles c ON c.id = cs.child_id
     WHERE cs.id = p_subscription_id
       AND c.account_profile_id = (auth.uid())::text);
$function$;

REVOKE ALL ON FUNCTION public.is_my_child_subscription(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_my_child_subscription(text) TO authenticated, service_role;

CREATE POLICY "Child account views own sessions" ON public.sessions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_my_child_subscription(course_subscription_id));

-- ══ ٤. الطفل يطلب قصة ═══════════════════════════════════════

ALTER TABLE public.dependent_requests
  ADD COLUMN product_id text REFERENCES public.personalized_products(id) ON DELETE SET NULL;

ALTER TABLE public.dependent_requests DROP CONSTRAINT dependent_requests_kind_check;
ALTER TABLE public.dependent_requests ADD CONSTRAINT dependent_requests_kind_check
  CHECK (kind IN ('service', 'package', 'name_change', 'product'));

ALTER TABLE public.dependent_requests DROP CONSTRAINT dependent_requests_target_check;
ALTER TABLE public.dependent_requests ADD CONSTRAINT dependent_requests_target_check CHECK (
     (kind = 'service' AND service_id IS NOT NULL AND package_id IS NULL AND requested_name IS NULL AND product_id IS NULL)
  OR (kind = 'package' AND package_id IS NOT NULL AND service_id IS NULL AND requested_name IS NULL AND product_id IS NULL)
  OR (kind = 'name_change' AND requested_name IS NOT NULL AND btrim(requested_name) <> ''
      AND service_id IS NULL AND package_id IS NULL AND product_id IS NULL)
  -- المنتج ممكن يتمسح بعدين (`ON DELETE SET NULL`) — فالطلب القديم بيفضل.
  OR (kind = 'product' AND service_id IS NULL AND package_id IS NULL AND requested_name IS NULL));

-- ══ ٥. طلبات تغيير موعد الجلسات ═════════════════════════════

CREATE TABLE public.session_change_requests (
  id                   uuid        DEFAULT gen_random_uuid() NOT NULL,
  session_id           text        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  requester_profile_id uuid        NOT NULL,
  requester_role       text        NOT NULL,
  proposed_at          timestamptz NOT NULL,
  reason               text        NOT NULL,
  status               text        DEFAULT 'pending' NOT NULL,
  admin_note           text,
  decided_by           uuid,
  decided_at           timestamptz,
  created_at           timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT session_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT session_change_requests_role CHECK (requester_role IN ('guardian', 'instructor', 'student')),
  CONSTRAINT session_change_requests_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT session_change_requests_reason CHECK (length(btrim(reason)) BETWEEN 3 AND 1000)
);

-- طلب معلّق واحد لكل جلسة — عشان الإدارة ماتوافقش على اتنين متعارضين.
CREATE UNIQUE INDEX session_change_requests_one_pending
  ON public.session_change_requests (session_id) WHERE status = 'pending';

ALTER TABLE public.session_change_requests ENABLE ROW LEVEL SECURITY;

-- الطلب لجلسة **يقدر يشوفها** (سياسات الجلسات نفسها بتقرّر) وباسمه هو.
CREATE POLICY "Session parties request changes" ON public.session_change_requests
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    requester_profile_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_change_requests.session_id));

CREATE POLICY "Requesters and admins read changes" ON public.session_change_requests
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (requester_profile_id = auth.uid() OR public.is_admin());

-- البتّ للإدارة بس.
CREATE POLICY "Admins decide changes" ON public.session_change_requests
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.session_change_requests TO authenticated;
GRANT ALL ON public.session_change_requests TO service_role;

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
SELECT 'مسودة تعديل الناشر' AS "البند",
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'personalized_products' AND column_name = 'pending_changes')
            THEN '✓' ELSE '✗' END AS "الحالة"
UNION ALL
SELECT 'الطفل يقرا جلساته',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Child account views own sessions')
            THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'طلب قصة من الطفل',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'dependent_requests' AND column_name = 'product_id')
            THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'طلبات تغيير المواعيد',
       CASE WHEN to_regclass('public.session_change_requests') IS NOT NULL THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'للمعلومة: مدربين مفعّلين ومقدّم الخدمة بتاعهم مفعّل',
       (SELECT count(*)::text FROM public.instructors i
          JOIN public.service_providers sp ON sp.instructor_id = i.id
         WHERE i.status = 'active' AND sp.status = 'active')
UNION ALL
SELECT 'للمعلومة: مدربين مفعّلين من غير مقدّم خدمة خالص',
       (SELECT count(*)::text FROM public.instructors i
         WHERE i.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.instructor_id = i.id));
