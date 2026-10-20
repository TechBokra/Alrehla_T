-- ============================================================
-- 20 — رفع الملفات في الخدمات ومساحة الكتابة (10 أكتوبر 2026)
-- ============================================================
--
-- ── اللي بيعمله (بالترتيب) ───────────────────────────────────
--
-- ١) «تسمح برفع ملفات» لكل خدمة إبداعية (قرار تامر):
--      allows_files     الخدمة دي بتقبل ملفات؟ (الافتراضي: لأ)
--      file_max_mb      حد حجم الملف — من ١ لـ١٠ ميجا (حد Cloudinary)
--      file_kinds       الأنواع المسموحة: pdf · word · image
--
-- ٢) جدول `private_files` — ملفات طلبات الخدمات ومساحة الكتابة.
--    الملف نفسه على Cloudinary **مخفي** (`authenticated`)، والجدول ده
--    بيحفظ رقمه بس. اللي يقدر يقرا الصف هو اللي ياخد رابط تحميل مؤقت.
--      • ملف طلب: العميل، ومقدّم الخدمة/المدرب المكلّف، والإدارة.
--      • ملف مستند: صاحبه، وولي أمره، ومدربه، والإدارة.
--    ⚠️ **الكتابة في الجدول من الخادم بس** (مفتاح الخدمة) بعد ما يتأكد
--       إن الملف اترفع فعلًا في مكانه وحجمه ونوعه مسموحين. مفيش سياسة
--       كتابة للمستخدم عن قصد — عشان محدش يسجّل رقم ملف مش بتاعه.
--    الملف بيتمسح من Cloudinary بعد مدة من قفل الطلب (الإعدادات)،
--    والصف بيفضل وعليه «اتمسح» عشان الطرفين يعرفوا.
--
-- ٣) 🔴 **«بدء التنفيذ» ماكانش بيشتغل لحد غير الإدارة.** حارس القاعدة
--    كان بيسمح لمقدّم الخدمة بانتقال واحد: «قيد التنفيذ ← سُلّم».
--    فلما المدرب يدوس «ابدأ التنفيذ» (مدفوع ← قيد التنفيذ) القاعدة
--    بترجّع الحالة زي ما كانت **من غير خطأ**، والشاشة تقول «تمام».
--    دلوقتي المسموح: مدفوع ← قيد التنفيذ، ومدفوع/قيد التنفيذ ← سُلّم.
--
-- ٤) `can_access_service_order` بقت بتشمل مقدّم الخدمة الفردي (مش
--    مدرب) — كان ليه سياسات لوحده على الرسايل، والملفات محتاجاه.
--
-- ⚠️ **مفيش مسح ولا تغيير لأي بيانات.** خانات جديدة وجدول جديد،
--    ودالتين بيتعدّلوا.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ما الكود يتنشر. في SQL Editor → Run. لو اتشغّل مرتين بيقول.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.private_files') IS NOT NULL THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'standalone_services'
                    AND column_name = 'delivery_days') THEN
    RAISE EXCEPTION 'شغّل ملف 09 الأول.';
  END IF;
END
$$;

-- ── ١) إعداد الملفات لكل خدمة ───────────────────────────────
ALTER TABLE public.standalone_services
  ADD COLUMN allows_files boolean  NOT NULL DEFAULT false,
  ADD COLUMN file_max_mb  smallint NOT NULL DEFAULT 10,
  ADD COLUMN file_kinds   text[]   NOT NULL DEFAULT ARRAY['pdf', 'word', 'image'];

ALTER TABLE public.standalone_services
  ADD CONSTRAINT standalone_services_file_max_mb_range
    CHECK (file_max_mb BETWEEN 1 AND 10),
  ADD CONSTRAINT standalone_services_file_kinds_known
    CHECK (file_kinds <@ ARRAY['pdf', 'word', 'image'] AND cardinality(file_kinds) >= 1);

-- ── ٢) جدول الملفات ─────────────────────────────────────────
CREATE TABLE public.private_files (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            text        REFERENCES public.service_orders(id) ON DELETE CASCADE,
  document_id         uuid        REFERENCES public.portfolio_documents(id) ON DELETE CASCADE,
  uploader_profile_id text        NOT NULL,
  file_name           text        NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
  public_id           text        NOT NULL UNIQUE,
  resource_type       text        NOT NULL CHECK (resource_type IN ('raw', 'image')),
  format              text,
  bytes               integer     NOT NULL CHECK (bytes > 0 AND bytes <= 10 * 1024 * 1024),
  -- ملف التسليم من مقدّم الخدمة (بيظهر مع رسالة التسليم).
  is_delivery         boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- اتمسح من Cloudinary (المدة خلصت) — الصف بيفضل للتاريخ.
  deleted_at          timestamptz,
  CONSTRAINT private_files_one_owner
    CHECK ((order_id IS NOT NULL) <> (document_id IS NOT NULL))
);

CREATE INDEX private_files_order_idx    ON public.private_files (order_id)    WHERE order_id IS NOT NULL;
CREATE INDEX private_files_document_idx ON public.private_files (document_id) WHERE document_id IS NOT NULL;
CREATE INDEX private_files_live_idx     ON public.private_files (created_at)  WHERE deleted_at IS NULL;

ALTER TABLE public.private_files ENABLE ROW LEVEL SECURITY;

-- ── ٤) مقدّم الخدمة الفردي جوّه «أطراف الطلب» ──────────────
CREATE OR REPLACE FUNCTION public.can_access_service_order(p_order_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM service_orders o
    LEFT JOIN instructors i        ON i.id = o.instructor_id
    LEFT JOIN service_providers sp ON sp.id = o.provider_id
    LEFT JOIN instructors i2       ON i2.id = sp.instructor_id
    WHERE o.id = p_order_id
      AND (
        o.buyer_profile_id = auth.uid()::text
        OR i.user_id = auth.uid()
        OR sp.user_id = auth.uid()
        OR i2.user_id = auth.uid()
        OR public.is_admin()
      )
  );
$function$;

-- قراية بس. الكتابة من الخادم (شوف فوق).
CREATE POLICY "Order participants read order files" ON public.private_files
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (order_id IS NOT NULL AND public.can_access_service_order(order_id));

CREATE POLICY "Document readers read document files" ON public.private_files
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (document_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.portfolio_documents d
     WHERE d.id = private_files.document_id
       AND (
             d.student_id = auth.uid()
          OR public.guardian_of_student(d.student_id::text)
          OR public.instructor_teaches(d.student_id::text)
          OR public.is_admin()
           )
  ));

-- ── ٣) مقدّم الخدمة يبدأ ويسلّم ──────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_service_order_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_the_provider BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- مقدّم الخدمة المكلَّف: مدرب بالطريقة القديمة، أو مقدّم بالجديدة.
  SELECT EXISTS (
    SELECT 1 FROM instructors i
    WHERE i.id = OLD.instructor_id AND i.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM service_providers sp
    LEFT JOIN instructors i2 ON i2.id = sp.instructor_id
    WHERE sp.id = OLD.provider_id
      AND (sp.user_id = auth.uid() OR i2.user_id = auth.uid())
  ) INTO is_the_provider;

  IF TG_OP = 'INSERT' THEN
    NEW.status             := 'pending';
    NEW.instructor_earning := NULL;
    NEW.delivered_at       := NULL;
    NEW.completed_at       := NULL;
    NEW.due_at             := NULL;
    NEW.due_note           := NULL;
    -- الدفع ما بيتسجّلش وقت إنشاء الطلب.
    NEW.payment_method      := NULL;
    NEW.payment_receipt_url := NULL;
    RETURN NEW;
  END IF;

  IF is_the_provider THEN
    -- مقدّم الخدمة (ملف 20): يبدأ (مدفوع ← قيد التنفيذ)، ويسلّم
    -- (مدفوع أو قيد التنفيذ ← سُلّم). كان مسموح له التسليم بس، فـ«ابدأ
    -- التنفيذ» كان بيرجع لورا من غير خطأ.
    IF NOT (
         (OLD.status = 'paid'                       AND NEW.status = 'in_progress')
      OR (OLD.status IN ('paid', 'in_progress')     AND NEW.status = 'delivered')
    ) THEN
      NEW.status := OLD.status;
    END IF;
    NEW.transaction_reference := OLD.transaction_reference;
    NEW.payment_method        := OLD.payment_method;
    NEW.payment_receipt_url   := OLD.payment_receipt_url;
  ELSE
    -- المشتري: انتقالان مسموحان — «حوّلت»، و«استلمت وأأكّد».
    IF OLD.status = 'pending' AND NEW.status = 'awaiting_verification' THEN
      NULL;
    ELSIF OLD.status = 'delivered' AND NEW.status = 'completed' THEN
      NEW.payment_method        := OLD.payment_method;
      NEW.payment_receipt_url   := OLD.payment_receipt_url;
    ELSE
      NEW.status                := OLD.status;
      NEW.transaction_reference := OLD.transaction_reference;
      NEW.payment_method        := OLD.payment_method;
      NEW.payment_receipt_url   := OLD.payment_receipt_url;
    END IF;
  END IF;

  -- الفلوس والأطراف والمهلة والرقم المرجعي: محدش غير الإدارة.
  NEW.id                    := OLD.id;
  NEW.buyer_profile_id      := OLD.buyer_profile_id;
  NEW.instructor_id         := OLD.instructor_id;
  NEW.provider_id           := OLD.provider_id;
  NEW.amount                := OLD.amount;
  NEW.instructor_earning    := OLD.instructor_earning;
  NEW.package_id            := OLD.package_id;
  NEW.standalone_service_id := OLD.standalone_service_id;
  NEW.created_at            := OLD.created_at;
  NEW.due_at                := OLD.due_at;
  NEW.due_note              := OLD.due_note;
  NEW.payment_reference     := OLD.payment_reference;

  RETURN NEW;
END
$function$;

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم كل السطور ✓.
SELECT 'إعداد الملفات لكل خدمة' AS "البند",
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'standalone_services' AND column_name = 'allows_files')
            THEN '✓' ELSE '✗' END AS "الحالة"
UNION ALL
SELECT 'جدول الملفات (قراية بس للمستخدمين)',
       CASE WHEN (SELECT count(*) FROM pg_policies WHERE tablename = 'private_files') = 2
            THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'مقدّم الخدمة يبدأ التنفيذ',
       CASE WHEN pg_get_functiondef('public.guard_service_order_fields()'::regprocedure) LIKE '%''paid''%''in_progress''%'
            THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'مقدّم الخدمة الفردي من أطراف الطلب',
       CASE WHEN pg_get_functiondef('public.can_access_service_order(text)'::regprocedure) LIKE '%sp.user_id%'
            THEN '✓' ELSE '✗' END;
