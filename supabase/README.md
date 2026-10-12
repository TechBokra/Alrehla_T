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

الـ migration الأخيرة تثبّت event trigger باسم `ensure_rls` لتمكين RLS تلقائيًا على أي جدول جديد في `public`. كل الجداول الحالية مفعّل عليها RLS، ودالة المحفّز لا يمكن استدعاؤها مباشرةً من أدوار التطبيق.

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

## البيانات الأولية والتنظيف

- `seed.sql` مفعّل في `config.toml` لبيئات التطوير المحلية. اختُبر على staging مرتين داخل معاملة تم التراجع عنها، لذلك لم يغيّر بيانات staging.
- لا تشغّل seed على production. `db push` لا ينشر seed تلقائيًا.
- `manual/first_admin.sql` يحتاج تعديل البريد التجريبي داخله إلى بريد الحساب المقصود قبل التشغيل.
- `maintenance/cleanup_test_data.sql` يحذف بيانات تشغيلية كثيرة ويعيد تسلسل أرقام الطلبات. هو إجراء يدوي منفصل، وليس migration أو جزءًا من إعادة البناء.
