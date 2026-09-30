-- ============================================================
-- 126 — تشخيص: دوال المدرب العامة قبل إضافة الغلاف
-- ============================================================
--
-- ⚠️ **الملف ده مابيغيّرش حاجة. بيقرا وبيطبع.**
--
-- ── إيه اللي كشفه تشخيص 125 ────────────────────────────────
--
-- **①** `instructors` **مافيهاش عمود صورة خالص.** صورة المدرب
--     بتيجي من `user_profiles.avatar_url` (عشان كده `avatarsByUserId`
--     موجودة في الكود). يعني الغلاف عمود **جديد بالكامل**.
--
-- **②** 🔴 **وسياسة الكتابة بتخلّي «الموافقة» اختيارية:**
--
--         Instructors can update their own profile
--         UPDATE · USING (auth.uid() = user_id) · CHECK: —
--
--     والحارس `guard_instructor_fields` بيجمّد ستة أعمدة بس:
--     `user_id` و`status` و`training_passed` و
--     `selected_pricing_option_id` و`weekly_schedule` و`is_sample`.
--
--     ⚠️ **يعني `bio` و`display_name` و`specialties` و
--        `years_experience` المدرب بيكتبها على الجدول مباشرةً** —
--        بلا أي مرور على `profile_update_requests`.
--
--     الشاشة بتبعت طلب موافقة، **والقاعدة بتقبل الكتابة المباشرة**.
--     فاللي عايز يتخطّى الموافقة بيقدر — مش بثغرة، بنداء API عادي.
--
--     ودي **نفس قاعدة الدرس 26 عندنا**: «الحارس على نصف المسار
--     أوحش من غيابه كله» — لأنه بيدّي إحساسًا إن الموضوع متغطّى.
--
--     **وده بيقرّر تصميم الغلاف:** لو ضفت `cover_image_url` وسِبته
--     زي `bio`، المدرب هيقدر ينشر غلافًا على طول والشاشة تقول
--     «في انتظار الموافقة» — **والصورة تكون ظاهرة للعملاء بالفعل**.
--     فالعمود الجديد **لازم يتجمّد في الحارس**.
--
-- ── واللي محتاجه دلوقتي ─────────────────────────────────────
--
-- صفحات المدربين العامة **مابتقراش من الجدول**، بتنادي دالتين
-- (ملف 83): `public_instructors()` و`public_instructor(p_id)` —
-- وهما بيرجّعا أعمدة محدَّدة بالاسم.
--
-- ⚠️ **يعني إضافة العمود للجدول مش هتخلّيه يظهر في أي صفحة.**
--    الدالتان لازم يتعدّلا — وعشان أعدّلهما بأمان محتاج **نصّهما
--    بالحرف**:
--
--    • `CREATE OR REPLACE FUNCTION` **بتوقيع مختلف بتضيف نسخة
--      تانية ومابتستبدلش** (مصيدة «س») — واللي حصل في ملف 86
--      وأوقع الحجز على الإنتاج.
--    • ونوع الإرجاع لو اتغيّر لازم `DROP` الأول — وde بيحتاج
--      معرفة مين بيعتمد عليها.
--
-- **وما بقراش الدوال من ذاكرتي ولا من ملفات المشروع.** القاعدة هي
-- مصدر الحقيقة — وأنا غلطت في ده تلات مرات قبل كده.
-- ============================================================

SELECT البند, التفاصيل, ملاحظة FROM (

  -- ══ ① نصّ الدالتين بالحرف ═════════════════════════════
  --
  -- ⚠️ `prosrc` لا `pg_get_functiondef`: التانية بترمي على الدوال
  --    التجميعية (مصيبة ملف 115). بس هنا محتاج **التوقيع كمان**،
  --    فبناخده من `pg_get_function_identity_arguments` لوحده —
  --    وهي مابترميش.
  SELECT
    ('دالة: ' || pr.proname || '(' || pg_get_function_identity_arguments(pr.oid) || ')')::text AS البند,
    pr.prosrc::text AS التفاصيل,
    '⬅️ ابعتهولي — هعدّل عليه بالحرف'::text AS ملاحظة
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid=pr.pronamespace
  WHERE n.nspname='public' AND pr.prokind='f'
    AND pr.proname IN ('public_instructors','public_instructor')

  UNION ALL

  -- ══ ② نوع الإرجاع — هل هو TABLE(...) ═════════════════
  --
  -- ⚠️ لو الإرجاع `TABLE(...)`، **إضافة عمود = تغيير نوع الإرجاع**،
  --    و`CREATE OR REPLACE` بترفض صراحةً. لازم `DROP` الأول —
  --    ولازم نعرف مين بيعتمد عليها قبل ما نحذف.
  SELECT
    ('نوع إرجاع: ' || pr.proname),
    pg_get_function_result(pr.oid),
    '⬅️ TABLE(...) معناه DROP قبل الإنشاء'
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid=pr.pronamespace
  WHERE n.nspname='public' AND pr.prokind='f'
    AND pr.proname IN ('public_instructors','public_instructor')

  UNION ALL

  -- ══ ③ كام نسخة من كل واحدة؟ (مصيدة «س») ══════════════
  SELECT
    'عدد نسخ الدوال العامة',
    COALESCE((
      SELECT string_agg(x.proname || ' ×' || x.c::text, ' · ')
      FROM (SELECT pr.proname, count(*) AS c
              FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace
             WHERE n.nspname='public'
               AND pr.proname IN ('public_instructors','public_instructor')
             GROUP BY pr.proname) x
    ), 'مفيش'),
    '⬅️ أي رقم غير ١ = فيه نسخة زيادة'

  UNION ALL

  -- ══ ④ مين مسموح له ينادي الدوال دي ═══════════════════
  --    الزائر (anon) لازم يقدر — دي صفحات عامة.
  SELECT
    ('صلاحية النداء: ' || pr.proname),
    COALESCE(array_to_string(pr.proacl::text[], ' | '), 'الافتراضي (PUBLIC)'),
    '⬅️ الزائر لازم يقدر ينادي'
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid=pr.pronamespace
  WHERE n.nspname='public' AND pr.prokind='f'
    AND pr.proname IN ('public_instructors','public_instructor')

  UNION ALL

  -- ══ ⑤ الزائر بيقرا instructors مباشرةً؟ ══════════════
  --
  -- السياسة المطبوعة في 125 كانت لـ`authenticated` بس. لو الزائر
  -- مالوش سياسة، يبقى الدوال هي الطريق الوحيد — وده بيأكّد إن
  -- جدول الأعمال الجديد محتاج سياسة قراءة **صريحة للزائر**، وإلا
  -- المعرض هيبان فاضيًا لأي حد مش مسجَّل دخول.
  --
  -- ⚠️ والصفوف الممنوعة بترجع **فاضية لا بخطأ** (قاعدة «ك») —
  --    يعني المعرض هيبان فاضيًا ومحدّش هيعرف ليه.
  SELECT
    'الزائر يقرا instructors؟',
    CASE WHEN has_table_privilege('anon','public.instructors','SELECT')
         THEN 'عنده صلاحية الجدول' ELSE 'لأ — الدوال هي الطريق' END,
    '⬅️ بيحدّد سياسة جدول الأعمال الجديد'

  UNION ALL

  -- ══ ⑥ instructor_certifications — موجود بالفعل ═══════
  --
  -- ظهر في تشخيص 125. لو شكله قريب من «الأعمال»، يبقى نستعمله
  -- بدل ما نعمل جديدًا — **جدولان بنفس الغرض أوحش من مفيش**:
  -- الشاشة بتقرا من واحد والإدارة بتكتب في التاني.
  SELECT
    ('instructor_certifications: ' || c.column_name),
    c.data_type,
    '⬅️ قريب من «الأعمال» ولا حاجة تانية خالص؟'
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='instructor_certifications'

) t ORDER BY البند;
