# قاعدة بيانات الرحلة

## المصدر المعتمد

- [`config.toml`](config.toml): إعداد Supabase CLI.
- [`migrations/`](migrations/): سجل تغييرات القاعدة المعتمد. الملفات مرقمة زمنيًا، وكل إصدار فيها مسجل كمطبّق على staging وproduction.
- [`seed.sql`](seed.sql): بيانات البداية المحلية. تُشغّل بعد الـ migrations عند `supabase db reset`.
- [`schema.sql`](schema.sql): نسخة مرجعية من لوحة Supabase فقط. لا تشغّلها؛ فهي لا تحتوي كل الدوال والسياسات والمحفّزات.
- [`manual/first_admin.sql`](manual/first_admin.sql): ترقية حساب موجود إلى مدير أول بعد التسجيل.
- [`maintenance/cleanup_test_data.sql`](maintenance/cleanup_test_data.sql): تنظيف نهائي لبيانات ما قبل الإطلاق (مسح نهائي). يرفض التشغيل من 1 نوفمبر 2026، ويرفض لو فيه صفوف في `private_files`/`private_file_cleanup_jobs`. تشغيله على production قرار صريح من صاحب المشروع قبل الإطلاق فقط — لا يُشغَّل تلقائيًا.

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

## استوديو القصص

تضيف [`migrations/20261016010000_story_studio_foundation.sql`](migrations/20261016010000_story_studio_foundation.sql) أساس استوديو إنتاج القصص المخصصة داخل لوحة الإدارة:

- صلاحيتان جديدتان في `admin_roles_known_permissions`: `canManageStudio` (إدارة الإنتاج والتسليم والتكلفة) و`canWorkStudio` (العمل في المشاريع المعيّنة)، مع ثلاثة أدوار جاهزة تُضاف إذا لم يوجد اسمها: «محرر قصص» و«مشرف فني» و«مسؤول إنتاج القصص».
- الجداول `story_projects` و`story_versions` و`story_pages` و`story_cost_entries` مع RLS؛ التكلفة مقصورة على `canManageStudio` و`canManageFinance`.
- محفّزات تفرض الانتقالات المسموحة بين الحالات، ومسؤول كل مرحلة، والشروط المسبقة (نص معتمد، موافقة العميل مع ملاحظة، موافقة ولي الأمر للوجه الحقيقي، اعتماد الشخصية والصفحات، قائمة فحص الجودة)، وتجميد النص المعتمد. تعديل النص بعد بدء الرسم لمسؤول الإنتاج فقط ويعيد الصفحات للمراجعة.
- دالة `story_start_project` لبدء مشروع يدويًا، ومحفّز على `orders` ينشئ المشروع تلقائيًا عند الدفع **فقط** إذا كان `site_settings.general.studioMode = 'on'` وكان المنتج `custom`. لقطة الطلب لا تتضمن `childPhoto`، والمحفّز يبتلع أي خطأ حتى لا يفشل تأكيد الدفع بسبب الاستوديو.

الاستوديو **مقفول افتراضيًا** (`studioMode` غير موجود = `off`). تشغيله من «إعدادات الاستوديو» في لوحة الإدارة لا يغيّر أي صفحة عامة.

اختبارات [`tests/story_studio_foundation.sql`](tests/story_studio_foundation.sql) تعمل داخل معاملة يتم التراجع عنها، وتغطي الصلاحيات وRLS لكل دور وكل بوابات الانتقال، ومنها أن فشل الإنشاء التلقائي لا يُفشل الدفع. تحتاج قاعدة محلية فيها مخطط الموقع.

تضيف [`migrations/20261016020000_story_studio_tasks_backfill.sql`](migrations/20261016020000_story_studio_tasks_backfill.sql) ربط مهام الإدارة والاستيراد بأثر رجعي:

- خط مهام جديد `studio` (مرحلة `fulfilment` فقط) في `work_tasks` و`assignment_rules`. مهمة واحدة لكل مشروع تتحدّث تلقائيًا بمرحلته: المحرر في مراحل النص، والمشرف الفني في مراحل الرسم، ومسؤول الإنتاج في الفحص والتسليم والإيقاف وعند غياب المعيّن أو إيقافه. المسؤولون يُحدَّدون من «توزيع المهام» (خط `studio`) وإلا من حاملي صلاحية `canManageStudio`. المسند له الجديد يصله إشعار، وفشل المزامنة لا يفشل أي عملية على المشروع.
- مهام «إنها لك» (مراجعة الدفع والتنفيذ) لا تُلمس؛ هي مهمة الطلب (التجهيز والشحن)، ومهمة الاستوديو هي المشروع (التأليف والرسم). القيد الفريد `(line, source_id, stage)` لا يتعارض لأن الخط مختلف.
- إلغاء الطلب أو ردّه والمشروع شغّال يضع علامة `order_closed_at` ويحوّل المهمة لمسؤول الإنتاج بعنوان تحذير؛ القرار (إلغاء المشروع) بشري.
- استيراد بأثر رجعي: البنود المخصّصة في طلبات `paid` أو `preparing` أو `shipped` بلا مشروع تُنشأ لها مشاريع مرة واحدة داخل الـ migration، وبعدها تتاح `story_backfill_projects()` لمسؤول الإنتاج (زر في إعدادات الاستوديو). الطلبات المسلَّمة والملغاة والتي لم تُدفع لا تُستورد (تُبدأ يدويًا من صفحة الطلب).

اختبار [`tests/story_studio_tasks_backfill.sql`](tests/story_studio_tasks_backfill.sql) يغطي ذلك ويؤكد أن مهام «إنها لك» الموجودة لا تتغير.

تضيف [`migrations/20261016030000_task_deadlines_stage_catalog.sql`](migrations/20261016030000_task_deadlines_stage_catalog.sql) مواعيد المهام وكتالوج المراحل وسجل المسار:

- `work_tasks`: أعمدة `step` (المرحلة الدقيقة: حالة الطلب أو مرحلة الاستوديو) و`step_changed_at` و`due_at` و`priority` وعلامتا الإشعار. الموعد يُحسب تلقائيًا من مهلة المرحلة (`task_steps.sla_hours`) عند دخول المهمة المرحلة؛ تعديل المهلة لا يغيّر مهام قائمة بل ما يدخل المرحلة بعده. مهلة فارغة = بلا موعد (مثل الإيقاف المؤقت).
- `task_steps`: كتالوج المراحل لكل خط (الاسم، الشرح، المهلة، صاحب المرحلة، ظهور التبويب). تعديله لمن له `canAssignWork`، ومراحل `studio` أيضًا لمن له `canManageStudio`. ترتيب مراحل الاستوديو وانتقالاتها صارت بيانات قابلة للتحرير من الشاشة بعد migration `20261016040000` (انظر أدناه).
- `work_task_events`: سجل كل ما حدث للمهمة (إنشاء، إسناد، انتقال مرحلة، موعد، أولوية، إنجاز، تذكير، ملاحظة). تكتبه triggers تلقائيًا، وللإداري ملاحظاته فقط. فشل أي trigger يتحول لتحذير ولا يُفشل الدفع أو تغيير الحالة.
- الإشعارات: `work_tasks_deadline_sweep()` (service_role فقط) يبعت «قرّب» (آخر ٢٥٪ من المهلة وبحد أدنى ساعتين) و«فات الموعد» مرة واحدة لكل مهمة، للمسند لهم أو للمديرين عند عدم الإسناد. يعمل من `work_tasks_sweep_if_due()` عند فتح صفحة المهام (مرة كل ١٠ دقائق) ومن cron يومي `/api/cron/task-deadlines` كشبكة أمان.
- بأثر رجعي: المهام المفتوحة تأخذ `step` وموعدها من تاريخ إنشائها، فالمتأخرة فعلًا تظهر متأخرة وتُرسل لها إشعارات «فات الموعد» مرة واحدة.

اختبار [`tests/task_deadlines.sql`](tests/task_deadlines.sql) يغطي ذلك (ويطبع `task_deadlines: OK`)، ويجب أن يمر معه `tests/story_studio_tasks_backfill.sql`. المهل الافتراضية في الـ seed تقديرية ويعدّلها المدير من «المراحل والمواعيد».

تضيف [`migrations/20261016040000_workflow_engine_unified_distribution.sql`](migrations/20261016040000_workflow_engine_unified_distribution.sql) محرك سير العمل ودمج الاستوديو في توزيع المهام:

- `task_steps` يصبح تعريف سير عمل الاستوديو: أعمدة `kind` (`start`/`stage`/`hold`/`done`/`cancel`) و`active` و`abilities` (`text`/`pages`) و`gates` (شروط دخول المرحلة من مفردات ثابتة) و`advance_by` (`owner`/`manager`) و`builtin`. الحركة «للأمام» تُحسب من `sort_order` (أقرب مرحلة فعّالة بعدها). مراحل الطلبات العادية بلا هيكل (قيد `task_steps_structure_line`).
- `optional`: مرحلة اختيارية تُتخطّى بزر «تخطّي» (`task_skip_target`) — الحركة للمرحلة التالية الفعّالة بعدها بشرط أن كل ما بينهما اختياري؛ شروط دخول المرحلة الهدف تبقى مطبّقة. الإلزامية هي الأصل. حذف مرحلة/استبدالها متاح (بلا مشاريع فيها)، والشروط حقائق لا ترتبط بمرحلة فتُعدَّل من «سلوك المرحلة».
- `task_edges`: الانتقالات الاستثنائية (رجوع/قفز) ومن ينفّذها وأثرها (`skip_gates`/`pages_redo`/`reset_qa`). الكتابة من الدوال فقط.
- الحرّاس الثلاثة (`story_project_guard` · `story_version_guard` · `story_page_guard`) تقرأ من الكتالوج بدل جداول مكتوبة في الكود؛ السلوك الأصلي محفوظ بالبذور وملف الاختبار الأصلي يمر بلا تعديل جوهري. رموز SQLSTATE كما هي (`23514` · `42501` · `55000`).
- «صاحب المرحلة» = المسند له مهمة المشروع المفتوحة، أو المحرر/المشرف المعيّن على المشروع (استثناء)، أو مسؤول الإنتاج (`story_is_worker`). لم يعد المطلوب دورًا مخصوصًا بالاستوديو.
- `assignment_rules.stage` يقبل مفتاح أي مرحلة في الكتالوج (محفّز `assignment_rules_valid_trg`) — مراحل الاستوديو وحالات الطلب الدقيقة (`paid`/`preparing`/…). `story_studio_access()` مشتق من التوزيع والمهام المفتوحة.

تضيف [`migrations/20261016050000_studio_product_routes.sql`](migrations/20261016050000_studio_product_routes.sql) **تسلسلًا لكل نوع منتج** (قصة مخصّصة):

- `studio_product_routes(product_id, step, state, gates_off)`: لكل منتج، المرحلة `required` (إلزامية) أو `optional` (تُتخطّى) أو `off` (غير مستخدمة)، وشروط دخول تُلغى له. المنتج بلا تخصيص يمشي على الكتالوج العام. الكتابة عبر `studio_route_set` / `studio_route_reset` (صلاحية `canManageStudio`) فقط.
- `task_effective_steps(line, product)` يعطي الكتالوج بعد تطبيق التخصيص؛ و`task_next_step` / `task_skip_target` / `story_transition_rule` أصبحت تقبل المنتج (اختياري)، و`story_project_guard` يطبّق تسلسل منتج المشروع وشروطه. المرحلة التي فيها مشاريع من المنتج لا تُعطَّل له.
- الاختبار: `tests/workflow_engine.sql` (القسم ١٣).
- دوال الإدارة (بصلاحية `canManageStudio` للاستوديو): `studio_stage_create/move/delete`, `studio_stage_flow`, `studio_edges_set`؛ و`task_rule_apply` لتطبيق التوزيع على المهام المفتوحة (`canAssignWork`، وللاستوديو `canManageStudio` أيضًا).
- `order_studio_projects(order)`: حالة مشاريع الاستوديو لرحلة الطلب لمن له `canManageOrders` أو وصول استوديو، دون النصوص ولا التكلفة.

اختبار [`tests/workflow_engine.sql`](tests/workflow_engine.sql) (يطبع `workflow_engine: OK`) يغطي المحرك؛ ويجب أن تمر معه الاختبارات الثلاثة السابقة. اختبارا `task_deadlines` و`story_studio_tasks_backfill` عُدّلا قليلًا (عدّ مراحل الاستوديو الفعلية؛ وبدون `SET ROLE` في اختبار فشل المزامنة لأن سياسات RLS صارت تقرأ جدول المهام).

ترتيب النشر:

1. انشر الكود أولًا. قبل تطبيق migration تكون صفحات الاستوديو في اللوحة فارغة أو تعرض خطأ تحميل، ولا شيء منها في الموقع العام.
2. طبّق migration على staging، ثم شغّل ملف الاختبار وراجع الأدوار الجديدة في صفحة الصلاحيات.
3. جرّب دورة كاملة على staging (طلب مخصص مدفوع ← مشروع ← تسليم) مع تشغيل الاستوديو، ثم أعده إلى `off`.
4. طبّق على production بعد نجاح staging، وأبقِ الاستوديو مقفولًا حتى يتم تعيين الفريق.

الطلبات المدفوعة قبل تشغيل الاستوديو لا تُنشأ لها مشاريع تلقائيًا؛ يبدأها مسؤول الإنتاج من صفحة الطلب. تعديل الأنواع في `src/types/supabase.ts` لهذه الجداول تم يدويًا بنفس صيغة المولَّد؛ أعد توليده بعد تطبيق migration على staging وراجع الفرق.

## مهام شحنات صندوق الرحلة

اشتراك «صندوق الرحلة» (٣ أو ٦ أو ١٢ شهرًا) له شحنة لكل شهر في `box_shipments`. تضيف [`migrations/20261016060000_box_shipment_tasks.sql`](migrations/20261016060000_box_shipment_tasks.sql) **مهمة مستقلة لكل شحنة**:

- المهمة `line='box'` · `stage='fulfilment'` · `step='shipment'` ومعرّف الشحنة في `source_id`، وموعدها (`due_at`) هو موعد الشحنة نفسه (`box_shipment_due`)، وتُفتح قبله بعدد أيام من الإعداد `site_settings.general.boxShipmentLeadDays` (الافتراضي ٧، من ١ إلى ٦٠، يُعدَّل من «سير العمل ← الصندوق ← الشحنات الشهرية»).
- المسؤولون من قاعدة التوزيع على المرحلة «شحنة الشهر» (`shipment`) وإلا قاعدة «التنفيذ» العامة للصندوق (`task_rule_people`).
- تُغلق المهمة عند الشحن/التسليم أو إلغاء/إيقاف الاشتراك، وتُعاد فتحها لو رجعت الشحنة لـ`pending`/`preparing`.
- المزامنة: محفّزان على `box_shipments` و`box_subscriptions`، و`box_shipment_tasks_sync()` تُستدعى من cron المهام (`/api/cron/task-deadlines`) ومن `work_tasks_sweep_if_due()` عند فتح صفحة المهام، فتُفتح المهام المستحقة بمرور الوقت.
- مهمة «التنفيذ» على مستوى الطلب لم تعد تُفتح لطلبات الصندوق (`work_tasks_on_status`)؛ والـmigration تُغلق المفتوحة منها للاشتراكات الموجودة وتفتح مهام الشحنات المستحقة حاليًا (مع إشعار المسؤولين).
- الاختبار: [`tests/box_shipment_tasks.sql`](tests/box_shipment_tasks.sql) (يطبع `box_shipment_tasks: OK`)، مع بقاء الاختبارات الأربعة السابقة ناجحة.

## البيانات الأولية والتنظيف

- `seed.sql` مفعّل في `config.toml` لبيئات التطوير المحلية. اختُبر على staging مرتين داخل معاملة تم التراجع عنها، لذلك لم يغيّر بيانات staging.
- لا تشغّل seed على production. `db push` لا ينشر seed تلقائيًا.
- `manual/first_admin.sql` يحتاج تعديل البريد التجريبي داخله إلى بريد الحساب المقصود قبل التشغيل.
- `maintenance/cleanup_test_data.sql` يحذف بيانات تشغيلية كثيرة ويعيد تسلسل أرقام الطلبات. هو إجراء يدوي منفصل، وليس migration أو جزءًا من إعادة البناء. ويرفض التشغيل من 1 نوفمبر 2026، أو إذا كانت `private_files`/`private_file_cleanup_jobs` فيها صفوف (حتى لا يمسح سجلات صور Cloudinary الخاصة قبل مسح الصور نفسها).
