-- ============================================================
-- One-time cleanup of pre-launch test data
-- ============================================================
--
-- ── ليه (قرار تامر، 10 أكتوبر) ───────────────────────────────
--
-- «بيانات الطلاب والمدربين والجلسات والطلبات كلها تجريبية — اللي فيه
--  مشاكل نقدر نمسحه». بيانات التجربة القديمة فيها صفوف اتعملت قبل
-- تصليحات كتير، وهي اللي بتطلّع أخطاء غريبة في الشاشات.
--
-- بيتشغّل **مرتين**: دلوقتي (عشان اختبار الفريق يبدأ نضيف)، ومرة قبل
-- الإطلاق بيوم (عشان نبدأ من الصفر). تاريخ الإطلاق المقصود لقفل الأمان
-- تحت: 1 نوفمبر 2026 — لو اتغيّر، غيّر التاريخ في الحارس قبل أي تشغيل.
--
-- ── بيمسح إيه ────────────────────────────────────────────────
--
--   الطلبات وتفاصيلها · اشتراكات الصندوق وشحناته · استخدامات أكواد الخصم
--   حجوزات الباقات · الجلسات وتقاريرها ورسايلها ومرفقاتها وطلبات تغيير
--     مواعيدها · محافظ الطلاب (مستندات مساحة العمل)
--   طلبات الخدمات ورسايلها وتقييماتها
--   مستحقات المدربين والناشرين وطلبات السحب
--   الإشعارات · «مهامي» · تذاكر الدعم وطلبات الجلسات المخصصة
--   طلبات الأبناء · طلبات حذف الحساب
--   ويرجّع ترقيم الطلبات (ALR-000001) من الأول.
--
-- ── بيسيب إيه ────────────────────────────────────────────────
--
--   **كل الحسابات** (إدارة، مدربين، ناشرين، مقدّمي خدمة، عملاء، أطفال)
--   المنتجات والباقات والخدمات والإضافات وخطط الصندوق وأكواد الخصم
--   المقالات والصفحات والصور والإعدادات وأسعار الشحن
--   ملفات المدربين وصورهم وأسعارهم، وطلبات تعديل ملفاتهم
--   طلبات الانضمام · آراء العملاء (feedback) · سجل التدقيق
--
-- ⚠️ **المسح نهائي.** ⚠️ **وبيرفض يشتغل من يوم الإطلاق (1 نوفمبر 2026)**
--    — عشان محدش يشغّله بالغلط على بيانات عملاء حقيقيين.
--
-- ⚠️ **وبيرفض يشتغل لو فيه ملفات خاصة متسجّلة** (`private_files` أو
--    `private_file_cleanup_jobs`): الجدولين دول بيشاوروا على `service_orders`
--    و`portfolio_documents`، و`TRUNCATE … CASCADE` كان هيمسحهم معاهم
--    **من غير ما الصور (صور الأطفال والإيصالات على Cloudinary) تتمسح** —
--    فتفضل يتيمة ومحدش يعرف يوصل لها. اترك مهمة التنظيف
--    (`/api/cron/private-files`) تفضّيهم الأول، أو امسح الصور من Cloudinary
--    بإيدك وبعدها امسح صفوفهم.
--
-- ⚠️ صور الإيصالات وصور الأطفال على Cloudinary مابتتمسحش من هنا (القاعدة
--    مابتوصلش لـCloudinary). الصور العامة اللي هتبقى متسابة بتتمسح من
--    «مكتبة الوسائط».
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- في SQL Editor → Run. بيطبع العدد قبل وبعد.
-- ============================================================

-- العدد قبل.
SELECT 'قبل' AS "الوقت",
  (SELECT count(*) FROM orders)              AS "طلبات المتجر",
  (SELECT count(*) FROM course_subscriptions) AS "حجوزات الباقات",
  (SELECT count(*) FROM sessions)            AS "الجلسات",
  (SELECT count(*) FROM service_orders)      AS "طلبات الخدمات",
  (SELECT count(*) FROM notifications)       AS "الإشعارات",
  (SELECT count(*) FROM user_profiles)       AS "الحسابات (مابتتمسحش)";

BEGIN;

DO $$
BEGIN
  IF now() >= timestamptz '2026-11-01 00:00:00 Africa/Cairo' THEN
    RAISE EXCEPTION 'الملف ده للتجربة قبل الإطلاق بس — مابيشتغلش من يوم 1 نوفمبر.';
  END IF;

  -- ملفات خاصة لسه ليها صفوف = الصور على Cloudinary لسه محتاجة تتمسح.
  -- (TRUNCATE ... CASCADE بيمسح الصفوف دي تبعًا لـservice_orders/portfolio_documents.)
  IF EXISTS (SELECT 1 FROM public.private_files)
     OR EXISTS (SELECT 1 FROM public.private_file_cleanup_jobs) THEN
    RAISE EXCEPTION 'فيه ملفات خاصة متسجّلة (private_files / private_file_cleanup_jobs) — فضّيها الأول بمهمة التنظيف أو من Cloudinary، وبعدين شغّل الملف ده.';
  END IF;
END
$$;

-- TRUNCATE بيمسح الكل مرة واحدة ومن غير ما يعدّي على محفّزات الصفوف
-- (الحراسات اللي بتمنع العميل يمسح طلب مثلًا).
--
-- ⚠️ **الجملة القديمة «مفيش جدول بيشاور على جدول من دول» كانت غلط**:
--    `private_files` بيشاور على `portfolio_documents` و`service_orders`،
--    و`private_file_cleanup_jobs` بيشاور على `private_files`. الحارس اللي
--    فوق بيمنع التشغيل لو فيهم صفوف، فالـCASCADE هنا ما بيمسحش حاجة فعلية.
--    ⚠️ لو اتضاف جدول جديد بيشاور على أي جدول تحت، راجع القايمة دي:
--    SELECT conrelid::regclass, confrelid::regclass FROM pg_constraint WHERE contype='f';
TRUNCATE TABLE
  public.order_items,
  public.orders,
  public.box_shipments,
  public.box_subscriptions,
  public.discount_code_uses,
  public.session_reports,
  public.session_messages,
  public.session_attachments,
  public.session_change_requests,
  public.sessions,
  public.course_subscriptions,
  public.portfolio_documents,
  public.reviews,
  public.service_order_messages,
  public.service_orders,
  public.instructor_payouts,
  public.publisher_payouts,
  public.withdrawal_requests,
  public.notifications,
  public.stale_order_notification_outbox,
  public.work_tasks,
  public.support_ticket_messages,
  public.support_tickets,
  public.support_session_requests,
  public.dependent_requests,
  public.account_deletion_requests
CASCADE;

-- ترقيم الطلبات من الأول (أول طلب حقيقي = ALR-000001).
ALTER SEQUENCE public.payment_reference_seq RESTART WITH 1;

-- «متسابة من إمتى» للصور: بيتحسب من جديد في المهمة الجاية.
DELETE FROM public.site_settings WHERE key = 'media_orphans';

COMMIT;

-- العدد بعد.
SELECT 'بعد' AS "الوقت",
  (SELECT count(*) FROM orders)              AS "طلبات المتجر",
  (SELECT count(*) FROM course_subscriptions) AS "حجوزات الباقات",
  (SELECT count(*) FROM sessions)            AS "الجلسات",
  (SELECT count(*) FROM service_orders)      AS "طلبات الخدمات",
  (SELECT count(*) FROM notifications)       AS "الإشعارات",
  (SELECT count(*) FROM user_profiles)       AS "الحسابات (مابتتمسحش)";
