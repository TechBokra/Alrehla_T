-- ============================================================================
-- صلاحية مستقلة لتوزيع المهام والطلبات: canAssignWork
-- ============================================================================
-- الغرض   : توزيع الشغل كان مربوطًا بصلاحيتين غلط:
--             • «توزيع الطلبات» (مين مسؤول عن أي مرحلة) كانت محتاجة
--               `canManageUsers` — يعني اللي بيوزّع الشغل لازم يقدر
--               **يعدّل الحسابات والصلاحيات كلها**. صلاحية أوسع بكتير
--               من اللي محتاجها.
--             • «سنّد المهمة لـ…» كانت متاحة **لأي إداري**، فمسؤول
--               المحتوى يقدر يسحب مراجعة دفع من المحاسب ويسنّدها لنفسه.
--
--           دلوقتي صلاحية واحدة مخصّصة للاتنين، تتدّي لمدير العمليات
--           من غير ما يبقى معاه مفاتيح الحسابات.
--
-- الأثر   : توسيع قيد `admin_roles_known_permissions` بس. **مفيش دور
--           بياخد الصلاحية تلقائيًا** — تتدّي يدويًا من:
--           المستخدمون ← الأدوار والصلاحيات.
--
-- ⚠️ لاحظ : بعد الملف ده، الإداري اللي مش معاه `canAssignWork` بيشوف
--    مهامه ويقفلها زيّ ما هو، بس **مش** بيقدر يغيّر مسؤول مهمة ولا
--    يعدّل التوزيع. فلو فيه حد بيعمل كده دلوقتي، إدّيله الصلاحية بعد
--    ما تشغّل الملف وقبل ما يحتاجها.
--
-- ⚠️ المدير العام (`super_admin`) ماعندوش دور مخصّص وبياخد كل الصلاحيات
--    من الكود — الوصول مابيتقطعش عنه بالتعديل ده.
--
-- التحقق  : select pg_get_constraintdef(oid) from pg_constraint
--             where conname = 'admin_roles_known_permissions';
--           ولازم تلاقي 'canAssignWork' في القايمة.
--
-- الرجوع  : شيل الصلاحية من كل الأدوار الأول، وبعدين رجّع القيد:
--   update public.admin_roles
--      set permissions = array_remove(permissions, 'canAssignWork')
--    where 'canAssignWork' = any(permissions);
--   alter table public.admin_roles drop constraint admin_roles_known_permissions;
--   alter table public.admin_roles add constraint admin_roles_known_permissions
--     check (permissions <@ ARRAY['canManageUsers','canManageInstructors',
--       'canManagePublishers','canManageCatalog','canManageSubscriptions',
--       'canManageOrders','canManageBookings','canManageSupport',
--       'canManageContent','canManageFinance','canManagePayments',
--       'canViewAuditLogs']::text[]);
-- ============================================================================

alter table public.admin_roles drop constraint if exists admin_roles_known_permissions;

alter table public.admin_roles
  add constraint admin_roles_known_permissions
  check (permissions <@ ARRAY[
    'canManageUsers',
    'canManageInstructors',
    'canManagePublishers',
    'canManageCatalog',
    'canManageSubscriptions',
    'canManageOrders',
    'canManageBookings',
    'canManageSupport',
    'canManageContent',
    'canManageFinance',
    'canManagePayments',
    'canAssignWork',
    'canViewAuditLogs'
  ]::text[]);
