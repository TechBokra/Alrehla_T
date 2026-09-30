-- ============================================================
-- 130 — المنتج كله بموافقة الإدارة + معرض صور ووصف كامل
-- ============================================================
--
-- ⚠️ **الملف ده بيغيّر مين يشوف الكتالوج. اقراه كله قبل ما
--    تشغّله.**
--
-- ════════════════════════════════════════════════════════════
-- إيه اللي كشفه تشخيص 129
-- ════════════════════════════════════════════════════════════
--
-- **①** الجدول عليه **سياستان وبس**:
--
--        Admins can manage products      ALL    · is_admin()
--        Products are viewable by everyone SELECT · USING (true)
--
--     يعني **مافيش ولا سياسة بتخلّي الناشر يكتب** — مع إن فيه
--     شاشات كاملة له (`/dashboard/publisher/products` بـ`new`
--     و`[id]`) وفرعًا كاملًا في `saveProduct`.
--
--     ⚠️ **والتعديل في الأكشن مافيهوش فحص عدد صفوف**: الصلاحيات
--        بترفض بصمت (قاعدة «ك») فالتعديل بيرجع **بلا خطأ وبصفر
--        صفوف**، والشاشة بتقول «اتحفظ» ومفيش حاجة اتغيّرت.
--
--     يعني شاشات الناشر **معطّلة بالكامل وبتبلّغ نجاحًا**.
--
-- **②** والقراءة `USING (true)` للجميع — يعني الزائر بيقرا
--     **الجدول كله**، والفلترة على `is_active` في **الكود وحده**.
--     أي نداء API مباشر بيشوف الموقوف.
--
-- ════════════════════════════════════════════════════════════
-- والتصميم — والحاجتان مربوطتان
-- ════════════════════════════════════════════════════════════
--
-- الموافقة بلا كتابة = زينة (مافيش حد بيقدّم)، والكتابة بلا
-- موافقة = خطر (الناشر ينشر على العميل مباشرةً). فالاتنين مع بعض:
--
--   **الناشر يقدر يكتب — ومافيش حاجة يكتبها بتظهر قبل المراجعة.**
--
-- ⚠️ **والفلترة في السياسة لا في الكود.** لو سِبتها في الكود، أي
--    نداء API مباشر يقرا غير المعتمد — والموافقة تبقى شكلية.
--
-- ⚠️ **وأي تعديل من الناشر بيرجّع الحالة «في الانتظار»** — حتى
--    تصحيح غلطة إملائية. التكلفة حقيقية (المنتج يقف عن البيع لحد
--    المراجعة)، والبديل أسوأ: الموافقة تبقى على **الصفّ** لا على
--    **اللي فيه**، فيرفع صورة سليمة وتوافق ويبدّلها.
--
-- ⚠️ **والسعر مش محتاج حارس خاص**: لو الناشر بعت سعرًا مظبوطًا
--    بنداء مباشر، التعديل بيرجّع الحالة «في الانتظار» فالسعر
--    **مايوصلش لعميل قبل ما إداري يشوفه**. الموافقة نفسها هي
--    الحارس.
--
-- ⚠️ **وأخطر خطوة: الموجود لازم يتعلّم «معتمد» في نفس المعاملة.**
--    العمود افتراضيه `pending`، فإضافته لوحدها معناها **كل منتجات
--    الموقع الخمسة تختفي في نفس اللحظة**. التحديث تحته جوّه نفس
--    `BEGIN` — مافيش لحظة واحدة الكتالوج بيبقى فيها فاضيًا.
-- ============================================================

BEGIN;

-- ══ ١) الأعمدة ═════════════════════════════════════════════
--
-- ⚠️ `text` + `CHECK` لا نوع `enum` جديد: إضافة قيمة لـenum
--    عملية مزعجة، والـ`CHECK` بيتعدّل بسطر. (نفس قرار ملف 127.)
ALTER TABLE public.personalized_products
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  -- صور إضافية: صفحات من جوّه الكتاب، الغلاف الخلفي، عيّنة رسومات
  ADD COLUMN IF NOT EXISTS gallery_image_urls text[],
  -- الوصف الكامل. `short_description` سطر للكارت، وده للصفحة.
  ADD COLUMN IF NOT EXISTS long_description text;

-- ══ ٢) 🔴 الموجود يتعلّم «معتمد» — في نفس المعاملة ═════════
--
-- من غير السطر ده، الخمسة منتجات بيخرجوا من الموقع دلوقتي حالًا.
UPDATE public.personalized_products
   SET review_status = 'approved',
       reviewed_at = COALESCE(reviewed_at, now())
 WHERE review_status = 'pending';

COMMENT ON COLUMN public.personalized_products.review_status IS
  'حالة مراجعة الإدارة. منفصل عن is_active عن قصد: is_active قرار إداري بالإيقاف، وde حالة في مسار المراجعة (ملف 130).';

-- ══ ٣) الحارس ══════════════════════════════════════════════
--
-- ⚠️ **الجدول مكانش عليه أي محفّز** (تشخيص 129) — فده جديد.
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

  NEW.updated_at := now();
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS guard_product_review_biu ON public.personalized_products;
CREATE TRIGGER guard_product_review_biu
  BEFORE INSERT OR UPDATE ON public.personalized_products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_review();

-- ══ ٤) السياسات ════════════════════════════════════════════
ALTER TABLE public.personalized_products ENABLE ROW LEVEL SECURITY;

-- ⚠️ **دي أخطر سطر في الملف.** السياسة القديمة `USING (true)`
--    بتتشال وتتبدّل بواحدة مفلترة. لو الشرط غلط، **الكتالوج
--    بيفضى للعميل**. استعلام التأكيد تحت بيعدّ اللي الزائر بيشوفه
--    فعلًا.
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.personalized_products;
CREATE POLICY "Anyone reads approved active products"
  ON public.personalized_products FOR SELECT
  TO anon, authenticated
  USING ( review_status = 'approved' AND is_active );

-- الناشر يشوف بتاعه كله — عشان يتابع المعلَّق والمرفوض.
-- ⚠️ من غيرها، منتجه اللي لسه بيتراجع **بيختفي من لوحته هو كمان**
--    وبيفتكر إنه اتمسح.
DROP POLICY IF EXISTS "Publisher reads own products" ON public.personalized_products;
CREATE POLICY "Publisher reads own products"
  ON public.personalized_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.publishers pub
             WHERE pub.id = personalized_products.publisher_id
               AND pub.user_id = auth.uid())
  );

-- ⚠️ **الكتابة دي جديدة تمامًا** — مكانش فيه أي سياسة بتسمح
--    للناشر يكتب، فشاشاته كانت معطّلة وبتبلّغ نجاحًا.
DROP POLICY IF EXISTS "Publisher adds own products" ON public.personalized_products;
CREATE POLICY "Publisher adds own products"
  ON public.personalized_products FOR INSERT
  TO authenticated
  WITH CHECK (
    review_status = 'pending'
    AND owner_type = 'publisher'
    AND EXISTS (SELECT 1 FROM public.publishers pub
                 WHERE pub.id = personalized_products.publisher_id
                   AND pub.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Publisher edits own products" ON public.personalized_products;
CREATE POLICY "Publisher edits own products"
  ON public.personalized_products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.publishers pub
             WHERE pub.id = personalized_products.publisher_id
               AND pub.user_id = auth.uid())
  );

-- ⚠️ **مافيش سياسة حذف للناشر عن قصد** — القاعدة عندنا: الإيقاف
--    بدل الحذف. ومنتج اتباع قبل كده بند في طلب قديم.

-- ⚠️ Supabase بيمنح `anon` صلاحيات واسعة (مصيدة ملف 82).
--    القراءة لازمة — دي صفحات عامة — والكتابة لأ.
REVOKE INSERT, UPDATE, DELETE ON public.personalized_products FROM anon;

COMMIT;

-- ============================================================
-- استعلام التأكيد — واحد
-- ============================================================
SELECT البند, التفاصيل, الحالة FROM (

  -- 🔴 أهم سطر: هل الكتالوج لسه بيبان؟
  SELECT
    'منتجات معتمدة ومفعّلة'::text AS البند,
    ((SELECT count(*)::text FROM public.personalized_products
       WHERE review_status='approved' AND is_active)
      || ' من ' || (SELECT count(*)::text FROM public.personalized_products))::text AS التفاصيل,
    CASE WHEN (SELECT count(*) FROM public.personalized_products
                WHERE review_status='approved' AND is_active) =
              (SELECT count(*) FROM public.personalized_products WHERE is_active)
         THEN '✅ كل المفعّل بقى معتمدًا — الكتالوج زيّ ما هو'
         ELSE '🔴 فيه منتج مفعّل ومش معتمد — هيختفي من الموقع' END AS الحالة

  UNION ALL

  SELECT 'سياسة: ' || p.policyname,
         p.cmd || ' · ' || array_to_string(p.roles, ',') || ' · ' || COALESCE(p.qual, p.with_check, '—'),
         '✅ اتعملت'
  FROM pg_policies p
  WHERE p.schemaname='public' AND p.tablename='personalized_products'

  UNION ALL

  SELECT 'الأعمدة الجديدة',
         COALESCE((SELECT string_agg(c.column_name, ', ' ORDER BY c.column_name)
                     FROM information_schema.columns c
                    WHERE c.table_schema='public' AND c.table_name='personalized_products'
                      AND c.column_name IN ('review_status','review_note','reviewed_at',
                                            'gallery_image_urls','long_description')), 'مفيش'),
         '✅ المفروض خمسة'

  UNION ALL

  SELECT 'الحارس شغّال؟',
         COALESCE((SELECT t.tgname FROM pg_trigger t
                    WHERE t.tgrelid='public.personalized_products'::regclass
                      AND NOT t.tgisinternal LIMIT 1), 'مفيش'),
         CASE WHEN EXISTS (SELECT 1 FROM pg_trigger t
                            WHERE t.tgrelid='public.personalized_products'::regclass
                              AND NOT t.tgisinternal)
              THEN '✅ موجود' ELSE '🔴 تعديل الناشر مش هيرجّع الحالة' END

  UNION ALL

  SELECT 'الزائر يكتب؟',
         CASE WHEN has_table_privilege('anon','public.personalized_products','INSERT')
               OR has_table_privilege('anon','public.personalized_products','UPDATE')
              THEN 'أيوه' ELSE 'لأ' END,
         CASE WHEN has_table_privilege('anon','public.personalized_products','INSERT')
               OR has_table_privilege('anon','public.personalized_products','UPDATE')
              THEN '🔴 اسحبها' ELSE '✅ مسحوبة' END

  UNION ALL

  SELECT 'الزائر يقرا؟',
         CASE WHEN has_table_privilege('anon','public.personalized_products','SELECT')
              THEN 'أيوه' ELSE 'لأ' END,
         CASE WHEN has_table_privilege('anon','public.personalized_products','SELECT')
              THEN '✅ لازم — صفحات عامة' ELSE '🔴 الكتالوج هيفضى للزائر' END

) t ORDER BY البند;

-- ============================================================
-- التراجع — معلَّق عن قصد.
--
-- ⚠️ **الأهم في التراجع إرجاع سياسة القراءة**، وإلا الكتالوج
--    بيفضل مفلترًا بعمود اتحذف.
-- ============================================================
-- BEGIN;
--   DROP TRIGGER IF EXISTS guard_product_review_biu ON public.personalized_products;
--   DROP FUNCTION IF EXISTS public.guard_product_review();
--   DROP POLICY IF EXISTS "Anyone reads approved active products" ON public.personalized_products;
--   DROP POLICY IF EXISTS "Publisher reads own products" ON public.personalized_products;
--   DROP POLICY IF EXISTS "Publisher adds own products" ON public.personalized_products;
--   DROP POLICY IF EXISTS "Publisher edits own products" ON public.personalized_products;
--   CREATE POLICY "Products are viewable by everyone"
--     ON public.personalized_products FOR SELECT USING (true);
--   ALTER TABLE public.personalized_products
--     DROP COLUMN IF EXISTS review_status,
--     DROP COLUMN IF EXISTS review_note,
--     DROP COLUMN IF EXISTS reviewed_at,
--     DROP COLUMN IF EXISTS gallery_image_urls,
--     DROP COLUMN IF EXISTS long_description;
-- COMMIT;
