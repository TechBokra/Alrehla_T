-- ============================================================================
-- لوحة تحكّم الشحن والتوصيل — SQL
-- ============================================================================
-- الملف ده **مرجع تشغيل**، مش migration. بيتفتح في Supabase ← SQL Editor،
-- وبتنسخ منه الجزء اللي محتاجه وتشغّله لوحده. مش مفروض تشغّل الملف كله.
--
-- ⚠️ قاعدة واحدة قبل أي تعديل:
--    القسم (أ) للقراءة فقط — شغّله الأول وشوف الوضع الحالي.
--    أقسام التعديل (ب) وما بعدها بتغيّر بيانات حيّة، وكل أمر فيها متعلّق
--    بسطر `-- ` عشان ما يتنفّذش بالغلط. شيل التعليق من السطر اللي عايزه بس.
--
-- ⚠️ الأسعار الحالية (34 منطقة) **تقديرية** ومش مراجَعة مع شركة شحن.
--    عمود is_estimate = true معناه «لسه محتاج مراجعة». بعد ما تتفق على
--    السعر الحقيقي، حدّثه من القسم (د) وهيتشال عنه وصف «تقديري».
--
-- ⚠️ الطلبات القديمة مابتتأثرش بأي تعديل هنا: كل طلب بيحفظ سعر الشحن
--    والدولة وقت تسجيله (لقطة تاريخية).
--
-- ⚠️ القواعد دي مفروضة في القاعدة نفسها عن طريق الدالة shipping_quote،
--    اللي بتناديها دوال تسجيل الطلب. يعني لو حد حاول يسجّل طلب لمنطقة
--    مقفولة من غير ما يعدّي على الموقع، القاعدة هي اللي بترفض.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════
-- (أ) اقرأ الوضع الحالي — آمن تمامًا، مجرد عرض
-- ════════════════════════════════════════════════════════════════════════

-- أ-١) ملخص سريع: إيقاف التوصيل العام + الدول المفتوحة
select
  (select value ->> 'paused'        from site_settings where key = 'delivery') as "التوصيل متوقف؟",
  (select value ->> 'pausedMessage' from site_settings where key = 'delivery') as "رسالة الإيقاف",
  (select count(*) from countries where physical_enabled)                      as "دول التوصيل المفتوحة",
  (select count(*) from countries where electronic_enabled)                    as "دول النسخة الإلكترونية",
  (select count(*) from shipping_rates where is_active)                         as "مناطق شحن مفعّلة",
  (select count(*) from shipping_rates where is_estimate)                       as "منها أسعار تقديرية";

-- أ-٢) الدول وحالتها
select code as "الكود", name_ar as "الدولة", dial_code as "مفتاح الاتصال",
       is_default as "افتراضية", is_listed as "تظهر في القائمة",
       physical_enabled as "التوصيل مفتوح", electronic_enabled as "النسخة الإلكترونية",
       unavailable_message as "رسالة الإغلاق"
from countries order by sort_order, name_ar;

-- أ-٣) المحافظات ومناطقها وأسعارها
select g.name_ar as "المحافظة", g.physical_enabled as "المحافظة مفتوحة",
       r.city as "المنطقة", r.fee as "سعر الشحن",
       r.is_active as "المنطقة مفعّلة", r.is_estimate as "السعر تقديري",
       r.eta_days_min as "أقل مدة (يوم)", r.eta_days_max as "أقصى مدة (يوم)"
from governorates g
left join shipping_rates r on r.country_code = g.country_code and r.governorate = g.name_ar
where g.country_code = 'EG'
order by g.sort_order, r.city;

-- أ-٤) الأسعار التقديرية اللي لسه محتاجة مراجعة
select governorate as "المحافظة", city as "المنطقة", fee as "السعر التقديري"
from shipping_rates where is_estimate order by fee, governorate, city;

-- أ-٥) جرّب القاعدة بنفسك: هل التوصيل متاح لمكان معيّن وبكام؟
--      (غيّر القيم التلاتة وشغّله — بيقرا بس، مابيسجّلش طلب)
select * from shipping_quote('EG', 'القاهرة', 'القاهرة');


-- ════════════════════════════════════════════════════════════════════════
-- (ب) إيقاف التوصيل مؤقتًا للموقع كله
-- ════════════════════════════════════════════════════════════════════════
-- أثره: صفحة الدفع بتمنع أي طلب فيه شحن وبتعرض رسالتك. النسخة الإلكترونية
-- بتفضل شغّالة عادي. استعمله في الأعياد أو لو شركة الشحن وقفت.

-- ب-١) إيقاف التوصيل (غيّر الرسالة زي ما تحب)
-- update site_settings
--    set value = jsonb_build_object(
--          'paused', true,
--          'pausedMessage', 'التوصيل متوقف مؤقتًا حتى نهاية إجازة العيد — النسخة الإلكترونية متاحة')
--  where key = 'delivery';

-- ب-٢) إرجاع التوصيل
-- update site_settings
--    set value = jsonb_build_object('paused', false, 'pausedMessage', '')
--  where key = 'delivery';


-- ════════════════════════════════════════════════════════════════════════
-- (ج) فتح وإغلاق الدول
-- ════════════════════════════════════════════════════════════════════════
-- حاليًا: مصر وحدها مفتوحة (توصيل + إلكتروني). باقي الـ21 دولة عربية
-- مسجّلة ومقفولة، وبتظهر للزائر برسالة «غير متاح الآن — سيتم التوفير قريبًا».

-- ج-١) افتح النسخة الإلكترونية لدولة (مفيش شحن، فمفيش محافظات مطلوبة)
--      ده أسهل وأسرع توسّع: المنتج بيوصل بالإيميل.
-- update countries set electronic_enabled = true, updated_at = now() where code = 'SA';

-- ج-٢) افتح التوصيل المادي لدولة
--      ⚠️ لازم الأول تسجّل محافظاتها ومناطقها وأسعارها (القسم هـ)،
--         وإلا كل محاولة طلب هتترفض بـ «المحافظة غير مسجّلة».
-- update countries set physical_enabled = true, updated_at = now() where code = 'SA';

-- ج-٣) اقفل دولة مرة تانية (وغيّر الرسالة اللي بتظهر للزائر)
-- update countries
--    set physical_enabled = false, electronic_enabled = false,
--        unavailable_message = 'التوصيل لبلدك هيكون متاح قريبًا — سجّل إيميلك ونبلّغك',
--        updated_at = now()
--  where code = 'SA';

-- ج-٤) اخفِ دولة من القائمة تمامًا (مش هتظهر للزائر أصلًا)
-- update countries set is_listed = false, updated_at = now() where code = 'SY';


-- ════════════════════════════════════════════════════════════════════════
-- (د) أسعار الشحن — التعديل الأهم قبل الإطلاق
-- ════════════════════════════════════════════════════════════════════════
-- بعد ما تتفق مع شركة الشحن على السعر الحقيقي، حدّثه هنا. تحديث السعر
-- بيشيل علامة «تقديري» تلقائيًا في الأوامر دي.

-- د-١) سعر منطقة واحدة
-- update shipping_rates
--    set fee = 70, is_estimate = false, updated_at = now()
--  where country_code = 'EG' and governorate = 'القاهرة' and city = 'القاهرة';

-- د-٢) سعر موحّد لكل مناطق محافظة
-- update shipping_rates
--    set fee = 80, is_estimate = false, updated_at = now()
--  where country_code = 'EG' and governorate = 'الدقهلية';

-- د-٣) تعديل كل الأسعار التقديرية مرة واحدة بنسبة (مثال: زيادة ١٠٪)
--      ⚠️ بيقرّب لأقرب جنيه، وبيسيب العلامة «تقديري» زي ما هي.
-- update shipping_rates
--    set fee = round(fee * 1.10), updated_at = now()
--  where is_estimate;

-- د-٤) اعتماد كل الأسعار التقديرية كما هي (بعد مراجعتها فعلًا)
--      ⚠️ ماتشغّلهوش إلا لو راجعت القايمة في (أ-٤) كلها.
-- update shipping_rates set is_estimate = false, updated_at = now() where is_estimate;

-- د-٥) مدة التوصيل المتوقعة لمنطقة (اختياري — بتظهر للعميل لو الكود بيعرضها)
-- update shipping_rates
--    set eta_days_min = 2, eta_days_max = 4, updated_at = now()
--  where country_code = 'EG' and governorate = 'أسوان';


-- ════════════════════════════════════════════════════════════════════════
-- (هـ) إضافة مناطق ومحافظات
-- ════════════════════════════════════════════════════════════════════════

-- هـ-١) منطقة جديدة داخل محافظة موجودة
--       (on conflict = لو المنطقة موجودة بيحدّث سعرها بدل ما يفشل)
-- insert into shipping_rates (country_code, governorate, city, fee, is_active, is_estimate)
-- values ('EG', 'القاهرة', 'التجمع الخامس', 65, true, false)
-- on conflict (country_code, governorate, city)
-- do update set fee = excluded.fee, is_active = true, is_estimate = excluded.is_estimate, updated_at = now();

-- هـ-٢) كذا منطقة مرة واحدة
-- insert into shipping_rates (country_code, governorate, city, fee, is_active, is_estimate)
-- select 'EG', v.gov, v.city, v.fee, true, false
-- from (values
--   ('القاهرة', 'مدينة نصر',    60),
--   ('القاهرة', 'المعادي',      60),
--   ('الجيزة',  '6 أكتوبر',     70)
-- ) as v(gov, city, fee)
-- on conflict (country_code, governorate, city)
-- do update set fee = excluded.fee, is_active = true, is_estimate = false, updated_at = now();

-- هـ-٣) محافظة جديدة (أو محافظات دولة عربية تانية قبل فتح التوصيل ليها)
-- insert into governorates (country_code, name_ar, sort_order)
-- values ('SA', 'الرياض', 1)
-- on conflict (country_code, name_ar) do nothing;


-- ════════════════════════════════════════════════════════════════════════
-- (و) إغلاق مؤقت لمحافظة أو منطقة
-- ════════════════════════════════════════════════════════════════════════
-- الفرق عن الحذف: الإغلاق بيحتفظ بالسعر والبيانات، وبيرجع بضغطة.
-- ⚠️ ماتحذفش منطقة ليها طلبات قديمة — الإغلاق أأمن دايمًا.

-- و-١) اقفل محافظة كاملة
-- update governorates set physical_enabled = false, updated_at = now()
--  where country_code = 'EG' and name_ar = 'شمال سيناء';

-- و-٢) افتحها تاني
-- update governorates set physical_enabled = true, updated_at = now()
--  where country_code = 'EG' and name_ar = 'شمال سيناء';

-- و-٣) اقفل منطقة واحدة
-- update shipping_rates set is_active = false, updated_at = now()
--  where country_code = 'EG' and governorate = 'البحر الأحمر' and city = 'الغردقة';


-- ════════════════════════════════════════════════════════════════════════
-- (ز) تسجيل تعديل المدونة في سجل الترحيلات
-- ════════════════════════════════════════════════════════════════════════
-- شغّلته من المحرر يدويًا، فمش مسجّل في سجل Supabase. السطر ده بيسجّله
-- عشان `supabase db push` على staging ما يحاولش يشغّله تاني.
-- (آمن ومابيغيّرش أي بيانات.)

-- insert into supabase_migrations.schema_migrations (version, name)
-- values ('20261015050000', 'blog_posts_draft_flag_and_visibility')
-- on conflict (version) do nothing;
