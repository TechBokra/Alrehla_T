# قاعدة بيانات الرحلة

## المصدر المعتمد

- [`config.toml`](config.toml): إعداد Supabase CLI.
- [`migrations/`](migrations/): سجل تغييرات القاعدة المعتمد. الملفات مرقمة زمنيًا، وكل إصدار فيها مسجل كمطبّق على staging وproduction.
- [`seed.sql`](seed.sql): بيانات البداية المحلية. تُشغّل بعد الـ migrations عند `supabase db reset`.
- [`schema.sql`](schema.sql): نسخة مرجعية من لوحة Supabase فقط. لا تشغّلها؛ فهي لا تحتوي كل الدوال والسياسات والمحفّزات.
- [`manual/first_admin.sql`](manual/first_admin.sql): ترقية حساب موجود إلى مدير أول بعد التسجيل.
- [`maintenance/cleanup_test_data.sql`](maintenance/cleanup_test_data.sql): تنظيف نهائي لبيانات ما قبل الإطلاق. لا تشغّله على production.

## المشاريع

| البيئة | حساب Supabase | اسم المشروع | Project ref |
| --- | --- | --- | --- |
| Staging | ahmed | Alrehla_T | `nznfawbcgfwpftbiqima` |
| Production | Supabase / techbokra | Alrehlat | `ruuejyignvuhouhoiiqi` |

تمت مطابقة سجل الـ migrations وبنية الجداول والسياسات والمحفّزات والفهارس والأنواع على المشروعين. سجل الإنتاج كان فارغًا قبل التهيئة، وتمت مطابقته مع السجل التاريخي بعد التأكد أن البنية القائمة تطابق migrations القديمة.

تثبّت migration باسم `enable_rls_for_new_public_tables` event trigger باسم `ensure_rls` لتمكين RLS تلقائيًا على أي جدول جديد في `public`. كل الجداول الحالية مفعّل عليها RLS، ودالة المحفّز لا يمكن استدعاؤها مباشرةً من أدوار التطبيق.

## دورة التغيير

ابدأ دائمًا على قاعدة محلية أو staging، ثم انشر التغيير إلى production بعد المراجعة:

```sh
supabase migration new describe_the_change
```

اكتب التغيير في الملف الجديد تحت `migrations/`. اختبر إعادة البناء محليًا إذا كان Docker يعمل:

```sh
supabase start
supabase db reset
supabase migration list
```

ثم اربط CLI بمشروع staging وادفع التغييرات المعلّقة:

```sh
supabase link --project-ref nznfawbcgfwpftbiqima
supabase migration list
supabase db push
```

بعد التحقق من staging، اربط CLI بمشروع production وراجع القائمة قبل الدفع:

```sh
supabase link --project-ref ruuejyignvuhouhoiiqi
supabase migration list
supabase db push
```

لا تعدّل production من SQL Editor أو Table Editor. تغييرات الإنتاج تمر عبر migrations المراجعة حتى يبقى سجل Git وسجل قاعدة البيانات متطابقين. لا تستخدم `supabase db reset` مع مشروع مربوط؛ هذا الأمر يعيد بناء قاعدة البيانات المحلية.

## دورة ملفات الطلبات والمستندات الخاصة

تغيير دورة الملفات الخاصة موجود في
[`migrations/20261013172327_reliable_private_file_lifecycle.sql`](migrations/20261013172327_reliable_private_file_lifecycle.sql).
وتوضح [`migrations/20261013172637_private_file_service_role_policies.sql`](migrations/20261013172637_private_file_service_role_policies.sql)
سياسات وصول `service_role` وتمنع إعادة إرسال طلب حذف لملف حذفه قيد الانتظار. تضيف migrations سجلات حجز الرفع ومهام حذف قابلة لإعادة المحاولة، وحالة دورة حياة للملفات الحالية من غير حذف سجلات أو أصول Cloudinary.
وفهارس [`migrations/20261013172850_index_private_file_cleanup_references.sql`](migrations/20261013172850_index_private_file_cleanup_references.sql)
تدعم مفاتيح jobs الخارجية عند حذف الملفات أو نوايا الرفع.
وتحافظ [`migrations/20261013173016_sync_legacy_private_file_deletion.sql`](migrations/20261013173016_sync_legacy_private_file_deletion.sql)
على توافق `deleted_at` مع الحالة الجديدة أثناء فترة الانتقال.
وتتحقق [`migrations/20261013174839_verify_private_file_upload_size.sql`](migrations/20261013174839_verify_private_file_upload_size.sql)
من تطابق حجم الأصل الفعلي مع الحجم المحجوز في تذكرة الرفع.
وتضيف [`migrations/20261013180656_harden_private_file_retry_and_capacity.sql`](migrations/20261013180656_harden_private_file_retry_and_capacity.sql)
حجز السعة حتى تأكيد تنظيف الرفع، وإعادة فحص قواعد الخدمة الحالية، وترتيب إعادة المحاولة حسب أقدم محاولة، وحذف المستند مع إعادة فحص صلاحية صاحبه داخل المعاملة.
هذه migrations الست مطبّقة على staging وproduction، وأرقام سجل القاعدة تطابق أسماء الملفات المحلية.

اختبارات [`tests/private_file_lifecycle_review.sql`](tests/private_file_lifecycle_review.sql) مخصصة للبيئة المحلية أو staging. تنشئ بيانات مؤقتة داخل معاملة يتم التراجع عنها، وتختبر السعة، والتسجيل المتكرر، وصلاحيات حذف المستند، وبقاء jobs بعد cascade، وترتيب المحاولات، وحماية claim token، وعدم تعطيل الملفات المنتهية بملفات نشطة قبلها. لا تتصل بـCloudinary ولا تُستخدم كـmigration.

ترتيب النشر مطلوب:

1. أوقف إصدار تذاكر الرفع القديمة على البيئة، وانتظر 75 دقيقة من آخر تذكرة قديمة حتى تنتهي نافذة توقيع Cloudinary وهامش الأمان.
2. طبّق migration على staging، ثم راجع الجداول والدوال وسياسات RLS واختبر الرفع والتسجيل والحذف وإعادة المحاولة.
3. انشر كود التذاكر الجديدة على staging وتأكد أن cron يعيد أعداد `queued`, `attempted`, `completed`, `failed`, و`pending`.
4. كرر التوقف والانتظار، ثم طبّق migration على production بعد نجاح staging، وبعدها انشر الكود.

تذاكر الرفع الجديدة صالحة داخل التطبيق 15 دقيقة. توقيع Cloudinary صالح ساعة؛ لذلك لا يبدأ تنظيف الرفع المتروك قبل مرور 75 دقيقة. روابط التنزيل الخاصة صالحة 10 دقائق. لا تنظّف أي أصل قديم لا يرتبط بسجل أو نية رفع موثوقة.

يُحدّث `src/types/supabase.ts` من أنواع Supabase بعد تطبيق migration على staging. يظل `schema.sql` لقطة مرجعية من لوحة Supabase وليس ملف تشغيل أو مصدرًا بديلًا لسجل migrations.

## البيانات الأولية والتنظيف

- `seed.sql` مفعّل في `config.toml` لبيئات التطوير المحلية. اختُبر على staging مرتين داخل معاملة تم التراجع عنها، لذلك لم يغيّر بيانات staging.
- لا تشغّل seed على production. `db push` لا ينشر seed تلقائيًا.
- `manual/first_admin.sql` يحتاج تعديل البريد التجريبي داخله إلى بريد الحساب المقصود قبل التشغيل.
- `maintenance/cleanup_test_data.sql` يحذف بيانات تشغيلية كثيرة ويعيد تسلسل أرقام الطلبات. هو إجراء يدوي منفصل، وليس migration أو جزءًا من إعادة البناء.
