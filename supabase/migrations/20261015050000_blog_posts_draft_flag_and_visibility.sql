-- ============================================================================
-- المدونة: عمود «مسودة» + إخفاء المقالات غير المنشورة من القاعدة نفسها
-- ============================================================================
--
-- الغرض
--   1. «المسودة» كانت مقالًا تاريخه بعد سنة من النهارده (حيلة)، فمكانش ممكن
--      نفرّق بينها وبين «مقال مجدول». نضيف `is_draft` صريح.
--   2. سياسة القراءة كانت `using (true)`: أي حد يقدر يقرا **كل** المقالات
--      (مسودات ومجدولة) من الـAPI مباشرةً، والإخفاء كان في الاستعلامات بس.
--      دلوقتي القاعدة نفسها بتخفي كل مقال مش منشور.
--
-- الأثر على البيانات الحالية
--   أي مقال تاريخه في المستقبل وقت التطبيق = مسودة قديمة بالحيلة (الجدولة
--   ماكانتش موجودة) → يتحوّل `is_draft = true`. باقي المقالات ما بتتغيّرش.
--   عمود جديد بقيمة افتراضية false، يعني الكود القديم شغّال زي ما هو.
--
-- الترتيب
--   يتطبّق قبل أو بعد نشر الكود الجديد. ⚠️ لو اتطبّق قبل: صفحة «إدارة
--   المدونة» في الكود القديم هتخبّي المسودات (بتقرا بعميل بلا جلسة) لحد
--   ما الكود الجديد ينزل. العرض للزوار مش متأثر.
--
-- التحقق
--   - زائر (anon) ما يشوفش مسودة ولا مقال مجدول، ويشوف المنشور.
--   - الأدمن يشوف الكل.
--
-- التراجع
--   drop policy "Published blog posts are public" on public.blog_posts;
--   create policy "Blog posts are viewable by everyone" on public.blog_posts
--     for select to public using (true);
--   alter table public.blog_posts drop column is_draft;
--   (المسودات القديمة هترجع تظهر بتاريخها المستقبلي، يعني لسه مخفية بالتاريخ.)
-- ============================================================================

alter table public.blog_posts
  add column if not exists is_draft boolean not null default false;

-- مسودات الحيلة القديمة (تاريخ في المستقبل) → مسودة صريحة.
update public.blog_posts
   set is_draft = true
 where is_draft = false
   and published_at > now();

drop policy if exists "Blog posts are viewable by everyone" on public.blog_posts;
drop policy if exists "Published blog posts are public" on public.blog_posts;

create policy "Published blog posts are public"
  on public.blog_posts
  for select
  to public
  using (
    public.is_admin()
    or (not is_draft and published_at <= now())
  );
