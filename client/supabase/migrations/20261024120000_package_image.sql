-- ═══════════════════════════════════════════════════════════════
-- صورة للباقة
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — طلب تامر (٢٤ أكتوبر): «نضيف للباقات إمكانية وضع صورة
--   علشان تبقى معبّرة عن المحتوى»، في صفحة الباقات وصفحة التفاصيل.
--
-- اللي بيتضاف
--   `creative_writing_packages.image_url` — رابط Cloudinary (الإدارة
--   بترفعه من شاشة الباقة). NULL = الباقة بتظهر بخلفية المسار بتاعها.
--
-- ⚠️ **وجدول الباقات اتضاف لقايمة فحص الصور** (`SCANNED_TABLES` في
--    `data/domains/(admin)/media/queries.ts`) في نفس التعديل. من غيره،
--    مهمة تنظيف الصور اليومية كانت هتشوف صورة الباقة «مش مستخدمة»
--    وتمسحها من Cloudinary.
--
-- الأثر
--   عمود واحد بقيمة فاضية. مفيش صف بيتغيّر.
--
-- الترتيب
--   مستقل. الكود بيشتغل قبله (الصورة مابتتحفظش، والشاشة بتقول ليه).
--
-- التحقق
--   select column_name from information_schema.columns
--    where table_name = 'creative_writing_packages' and column_name = 'image_url';
--   ← image_url
--
-- الرجوع للخلف
--   alter table public.creative_writing_packages drop column if exists image_url;
-- ═══════════════════════════════════════════════════════════════

alter table public.creative_writing_packages
  add column if not exists image_url text;

comment on column public.creative_writing_packages.image_url is
  'صورة الباقة (Cloudinary). بتظهر في كارت الباقة وفي صفحة التفاصيل. NULL = خلفية المسار.';
