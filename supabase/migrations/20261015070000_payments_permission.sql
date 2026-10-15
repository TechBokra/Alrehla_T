-- ============================================================================
-- صلاحية مستقلة لإعدادات الدفع: canManagePayments
-- ============================================================================
-- الغرض   : إعدادات الدفع (فتح البوابة، رقم المحفظة اللي بتستقبل التحويلات)
--           كانت موزّعة على صلاحيتين: «المحتوى وإعدادات الموقع» و«الطلبات
--           والشحن». الاتنين واسعين، ومسؤول محتوى ماينفعش يغيّر الرقم اللي
--           بيوصله فلوس العملاء. دلوقتي صلاحية واحدة مخصّصة ليها.
--
-- الأثر   : توسيع قيد `admin_roles_known_permissions` بس. مفيش دور بياخد
--           الصلاحية تلقائيًا — تتدّي يدويًا من: المستخدمون ← الأدوار.
--
-- ⚠️ المدير العام (`super_admin`) ماعندوش دور مخصّص، فبياخد كل الصلاحيات
--    من الكود — يعني الوصول مابيتقطعش عنه بالتعديل ده.
--
-- التحقق  : select pg_get_constraintdef(oid) from pg_constraint
--             where conname = 'admin_roles_known_permissions';
--           ولازم تلاقي 'canManagePayments' في القايمة.
--
-- الرجوع  : شيل الصلاحية من كل الأدوار الأول، وبعدين رجّع القيد القديم:
--   update public.admin_roles
--      set permissions = array_remove(permissions, 'canManagePayments')
--    where 'canManagePayments' = any(permissions);
--   alter table public.admin_roles drop constraint admin_roles_known_permissions;
--   alter table public.admin_roles add constraint admin_roles_known_permissions
--     check (permissions <@ ARRAY['canManageUsers','canManageInstructors',
--       'canManagePublishers','canManageCatalog','canManageSubscriptions',
--       'canManageOrders','canManageBookings','canManageSupport',
--       'canManageContent','canManageFinance','canViewAuditLogs']::text[]);
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
    'canViewAuditLogs'
  ]::text[]);
