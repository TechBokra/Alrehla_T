-- ============================================================
-- 06 — ترتيب منتجات «أنت البطل هنا» + خانات التخصيص من اللوحة
-- ============================================================
--
-- ── ١. الترتيب (ملاحظة فريق العمل ٨) ────────────────────────
--
-- المنتجات كانت بتتعرض بالأحدث أولًا ومفيش طريقة تغيّر ده. عمود جديد
-- `sort_order` في `personalized_products`: الأصغر يظهر الأول. والإدارة
-- بتحرّكه بأسهم ↑↓ من «ترتيب أنت البطل هنا».
--
-- • منتجات «مخصص» الموجودة بتاخد ترتيبها الحالي (الأحدث أولًا) — يعني
--   الموقع مش هيتغيّر شكله لحد ما حد يحرّك حاجة.
-- • المنتج الجديد بياخد صفر فيظهر أول القايمة لحد ما يترتّب.
-- • الناشر مايقدرش يغيّر الترتيب (الحارس بيرجّع القيمة القديمة) —
--   الترتيب قرار الإدارة.
--
-- ── ٢. خانات التخصيص (ملاحظة فريق العمل ٧ — قرار تامر) ──────
--
-- جدول `customization_fields`: خانات **نص قصير** بتظهر للعميل في خطوة
-- التخصيص، **واحدة لكل المنتجات** (القصة المخصصة، تخصيص غلاف المكتبة،
-- صندوق الرحلة). الإدارة بتضيف وتعدّل وتمسح وترتّب، وتقدر تخلّي الخانة
-- إلزامية أو توقفها مؤقتًا.
--
-- • **خانات الأساس ثابتة ومش في الجدول ده**: اسم الطفل، تاريخ الميلاد،
--   صورته — ومعاهم خانات القصة الحالية (الهدف، وصف البطل، الإهداء،
--   أسماء العائلة). الخانات الجديدة بتتضاف تحتهم.
-- • إجابة العميل بتتحفظ في الطلب **ومعاها اسم الخانة وقت الطلب** —
--   فلو الإدارة غيّرت اسم خانة أو مسحتها بعدين، الطلبات القديمة
--   بتفضل مقروءة.
-- • الزائر بيقرا الخانات المفعّلة بس. الكتابة للإدارة وحدها.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 05. مرة واحدة في SQL Editor → Run. وحدة واحدة: يا يتنفّذ كله
-- يا ولا حاجة. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.customization_fields') IS NOT NULL THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF to_regclass('public.admin_roles') IS NULL THEN
    RAISE EXCEPTION 'شغّل ملف 05 الأول.';
  END IF;
END
$$;

-- ── ١. عمود الترتيب ─────────────────────────────────────────

ALTER TABLE public.personalized_products
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- الترتيب الحالي (الأحدث أولًا) بأرقام 10، 20، 30… — المسافة بينهم
-- مش ضرورية بس بتسهّل أي تعديل يدوي بعدين.
UPDATE public.personalized_products p
   SET sort_order = r.rn * 10
  FROM (
    SELECT id, row_number() OVER (ORDER BY created_at DESC) AS rn
      FROM public.personalized_products
     WHERE category = 'custom'
  ) r
 WHERE p.id = r.id;

-- ── ٢. الحارس: الناشر مايغيّرش الترتيب ──────────────────────
-- نفس دالة ملف 01 بالحرف + سطر `sort_order` في الحالتين.

CREATE OR REPLACE FUNCTION public.guard_product_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- فاضية = مفتاح الخدمة · والإداري هو المُوافِق.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    -- ختم وقت الاعتماد لما الإداري يعتمد.
    IF TG_OP = 'UPDATE'
       AND NEW.review_status = 'approved'
       AND OLD.review_status IS DISTINCT FROM 'approved' THEN
      NEW.reviewed_at := now();
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- ⚠️ الناشر مايقررش إنه معتمد. السياسة بتفحص ده كمان —
    --    والاتنين لازمين: السياسة بتقفل الإدراج، والحارس بيقفل
    --    التعديل.
    NEW.review_status := 'pending';
    NEW.review_note   := NULL;
    NEW.reviewed_at   := NULL;
    -- ⭐ ملف 06: الترتيب قرار الإدارة.
    NEW.sort_order    := 0;
    NEW.updated_at    := now();
    RETURN NEW;
  END IF;

  -- ══ تعديل من غير إداري ═══════════════════════════════
  --
  -- ⚠️ **الحالة بترجع «في الانتظار» مهما كان اللي اتغيّر.**
  --    مافيش قايمة حقول هنا عن قصد: القايمة بتنسى حقلًا، والنسيان
  --    معناه «وافق على الصفّ وبدّل المحتوى».
  NEW.review_status := 'pending';
  NEW.review_note   := OLD.review_note;
  NEW.reviewed_at   := OLD.reviewed_at;

  -- وحاجات مش بتاعته أصلًا.
  NEW.owner_type    := OLD.owner_type;
  NEW.publisher_id  := OLD.publisher_id;
  NEW.is_active     := OLD.is_active;
  NEW.slug          := OLD.slug;
  -- ⭐ ملف 06
  NEW.sort_order    := OLD.sort_order;

  NEW.updated_at := now();
  RETURN NEW;
END
$function$
;

-- ── ٣. جدول خانات التخصيص ───────────────────────────────────

CREATE TABLE public.customization_fields (
  id          uuid        DEFAULT gen_random_uuid() NOT NULL,
  label       text        NOT NULL,
  placeholder text,
  is_required boolean     DEFAULT false NOT NULL,
  is_active   boolean     DEFAULT true  NOT NULL,
  sort_order  integer     DEFAULT 0     NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT customization_fields_pkey PRIMARY KEY (id),
  CONSTRAINT customization_fields_label_length
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  CONSTRAINT customization_fields_placeholder_length
    CHECK (placeholder IS NULL OR char_length(placeholder) <= 120)
);

CREATE INDEX customization_fields_order_idx
  ON public.customization_fields (sort_order, created_at);

-- ── ٤. الصلاحيات على الجدول ─────────────────────────────────

ALTER TABLE public.customization_fields ENABLE ROW LEVEL SECURITY;

-- الزائر والعميل: المفعّل بس (بيظهر في خطوة التخصيص). الإداري: كله.
CREATE POLICY "Active customization fields are public" ON public.customization_fields
  AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (is_active OR public.is_admin());

CREATE POLICY "Admins manage customization fields" ON public.customization_fields
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.customization_fields FROM anon;
REVOKE TRUNCATE ON public.customization_fields FROM authenticated;
GRANT SELECT ON public.customization_fields TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.customization_fields TO authenticated;

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم يطلع ٣ سطور كلها ✓.
SELECT 'عمود الترتيب' AS "البند",
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'personalized_products'
            AND column_name = 'sort_order'
       ) THEN '✓' ELSE '✗' END AS "الحالة",
       (SELECT count(*) FROM public.personalized_products WHERE category = 'custom')::text
         || ' منتج «مخصص» اترتّب' AS "تفاصيل"
UNION ALL
SELECT 'جدول خانات التخصيص',
       CASE WHEN to_regclass('public.customization_fields') IS NOT NULL THEN '✓' ELSE '✗' END,
       'فاضي — الخانات بتتضاف من اللوحة'
UNION ALL
SELECT 'سياسات الجدول',
       CASE WHEN (SELECT count(*) FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'customization_fields') = 2
            THEN '✓' ELSE '✗' END,
       'قراءة للمفعّل · كتابة للإدارة';
