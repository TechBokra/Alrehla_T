-- ============================================================
-- بناء قاعدة «الرحلة» من الصفر — شكل القاعدة كامل
-- ============================================================
--
-- ── ده إيه ──────────────────────────────────────────────────
--
-- القاعدة القديمة اتمسحت يوم 2 أكتوبر 2026. الملف ده بيبنيها تاني
-- **بنفس الشكل بالظبط** اللي كانت عليه لحظة المسح — مأخوذ من نتيجة
-- ملف 141 (CSV) اللي اتطبعت قبلها بساعة.
--
-- ✅ **مافيهوش بيانات** — الشكل بس: 49 جدول، 49 دالة، 24 محفّز،
--    143 سياسة صلاحيات، 29 فهرس، 45 رابط بين الجداول.
--
-- ── اللي اتشال عن قصد (كان موجود ومحدّش بيستعمله) ─────────
--
--   الجداول: bookings · instructor_services · instructor_compensation_profiles
--            · instructor_weekly_slots — ولا سطر في الكود بيقراها أو بيكتب فيها.
--            (instructor_services اتبدّل بـ provider_services من ملف 63.)
--   الأنواع اللي كانت بتاعتها بس: booking_status_enum · commitment_type ·
--            compensation_approval_status · compensation_billing_model · day_of_week
--   الدالة: guard_instructor_service_fields (حارس الجدول اللي اتشال)
--   والدالة instructor_teaches اتشال منها الجزء اللي بيقرا من bookings.
--
-- ── اللي اتضاف (كان موجود برّه ملف 141) ─────────────────────
--
--   • تسلسل الرقم المرجعي payment_reference_seq (ALR-000001-XX)
--   • محفّزين على حسابات الدخول: حساب جديد ← صفّ في user_profiles،
--     وإيميله ← user_emails
--   • صلاحيات الجداول اللي ملفات 122 و121 و127 كانت شايلاها من الزائر
--
-- ── اتجرّب إزاي ─────────────────────────────────────────────
--
-- اتشغّل على Postgres 16 محلي فيه نفس أدوار Supabase، وبعدين اتطبع
-- شكله بملف 141 واتقارن بالـ CSV القديم سطر بسطر: **متطابق** (ماعدا
-- اللي فوق). وتجربة سلوك: حساب جديد بيتعمله ملف، العميل بيطلب وبيدفع
-- المبلغ الصح، مابيقدرش يرقّي نفسه، والزائر مابيشوفش طلبات ولا حسابات.
--
-- ── إزاي يتشغّل ─────────────────────────────────────────────
--
-- ⚠️ **على مشروع Supabase جديد وفاضي بس.** لو لقى جداول في القاعدة بيقف
--    من غير ما يعمل حاجة.
-- انسخ الملف كله في SQL Editor ← Run. الملف كله معاملة واحدة: يا يتنفّذ
-- كله، يا مايتنفّذش منه حاجة.
-- ============================================================

BEGIN;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public') THEN
    RAISE EXCEPTION 'القاعدة فيها جداول بالفعل — الملف ده لمشروع جديد فاضي بس. ماحصلش أي تغيير.';
  END IF;
END
$guard$;

-- ════════════════════════════════════════════════════════════
-- ٠. الإضافات والأنواع وتسلسل الرقم المرجعي
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE TYPE public.age_group AS ENUM ('under_12', '12_plus');
CREATE TYPE public.document_status_enum AS ENUM ('draft', 'submitted', 'reviewed');
CREATE TYPE public.instructor_status_enum AS ENUM ('pending_training', 'pending_approval', 'active', 'suspended');
CREATE TYPE public.join_request_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.order_status_enum AS ENUM ('pending', 'awaiting_verification', 'paid', 'failed', 'refunded', 'preparing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE public.owner_type AS ENUM ('platform', 'publisher');
CREATE TYPE public.payout_status_enum AS ENUM ('pending', 'paid');
CREATE TYPE public.product_category AS ENUM ('library', 'custom', 'subscription');
CREATE TYPE public.provider_kind AS ENUM ('platform', 'instructor', 'individual');
CREATE TYPE public.provider_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE public.publisher_status_enum AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE public.service_order_status AS ENUM ('pending', 'awaiting_verification', 'paid', 'refunded', 'in_progress', 'delivered', 'completed', 'cancelled');
CREATE TYPE public.sub_status_enum AS ENUM ('active', 'cancelled', 'paused');
CREATE TYPE public.support_session_status_enum AS ENUM ('pending', 'contacted', 'resolved');
CREATE TYPE public.ticket_status_enum AS ENUM ('open', 'answered', 'closed');
CREATE TYPE public.update_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.user_role_enum AS ENUM ('visitor', 'customer', 'student', 'instructor', 'publisher', 'general_supervisor', 'super_admin', 'service_provider');
CREATE TYPE public.work_model_enum AS ENUM ('per_session', 'monthly');

CREATE SEQUENCE IF NOT EXISTS public.payment_reference_seq;
CREATE OR REPLACE FUNCTION public.next_payment_reference()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- حروف وأرقام من غير المتشابهين في الخط (0/O و1/I/L) عشان الناس
  -- بتقرا الرقم ده وتكتبه في تطبيق التحويل.
  alphabet CONSTANT text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  suffix   text := '';
  i        integer;
BEGIN
  FOR i IN 1..2 LOOP
    suffix := suffix || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;

  RETURN 'ALR-' || lpad(nextval('public.payment_reference_seq')::text, 6, '0') || '-' || suffix;
END
$function$
;

-- ════════════════════════════════════════════════════════════
-- ١. الجداول (49)
-- من غير الروابط — بتتضاف في القسم ٣ بعد ما كل الجداول تبقى موجودة.
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.account_deletion_requests (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  user_id uuid NOT NULL,
  reason text,
  status text DEFAULT 'pending'::text NOT NULL,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  handled_at timestamp with time zone,
  handled_by uuid,
  CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id),
  CONSTRAINT account_deletion_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'done'::text, 'rejected'::text])))
);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.addon_products (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  supports_customization boolean DEFAULT false NOT NULL,
  customization_price numeric DEFAULT 0 NOT NULL,
  CONSTRAINT addon_products_pkey PRIMARY KEY (id),
  CONSTRAINT addon_products_slug_key UNIQUE (slug),
  CONSTRAINT addon_customization_price_check CHECK ((customization_price >= (0)::numeric)),
  CONSTRAINT addon_products_price_check CHECK ((price >= (0)::numeric))
);
ALTER TABLE public.addon_products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  actor_profile_id text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.blog_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  cover_image_url text,
  author_name text DEFAULT 'فريق الرحلة'::text NOT NULL,
  published_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT blog_posts_pkey PRIMARY KEY (id),
  CONSTRAINT blog_posts_slug_key UNIQUE (slug)
);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.box_shipments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  subscription_id uuid NOT NULL,
  month_number integer NOT NULL,
  goal text,
  status text DEFAULT 'pending'::text NOT NULL,
  tracking_reference text,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT box_shipments_pkey PRIMARY KEY (id),
  CONSTRAINT box_shipments_subscription_id_month_number_key UNIQUE (subscription_id, month_number),
  CONSTRAINT box_shipments_month_number_check CHECK ((month_number >= 1)),
  CONSTRAINT box_shipments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'preparing'::text, 'shipped'::text, 'delivered'::text])))
);
ALTER TABLE public.box_shipments ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.box_shipments IS 'شحنة كل شهر في اشتراك صندوق الرحلة (ملف 140).';

CREATE TABLE public.box_subscription_plans (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  name text NOT NULL,
  price_total numeric NOT NULL,
  price_monthly numeric NOT NULL,
  duration_months integer NOT NULL,
  savings_note text,
  image_url text,
  description text,
  features text[] DEFAULT '{}'::text[] NOT NULL,
  is_highlighted boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  addon_discount_percent smallint DEFAULT 0 NOT NULL,
  free_addon_id text,
  CONSTRAINT box_subscription_plans_pkey PRIMARY KEY (id),
  CONSTRAINT box_plans_discount_check CHECK (((addon_discount_percent >= 0) AND (addon_discount_percent <= 90)))
);
ALTER TABLE public.box_subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.box_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  customer_name text NOT NULL,
  plan_name text NOT NULL,
  status sub_status_enum DEFAULT 'active'::sub_status_enum NOT NULL,
  next_shipment_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  order_id uuid,
  plan_id text,
  months integer,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  addon_discount_percent smallint DEFAULT 0 NOT NULL,
  free_addon_name text,
  details jsonb,
  CONSTRAINT box_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT box_subscriptions_order_id_key UNIQUE (order_id)
);
ALTER TABLE public.box_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.child_profiles (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  user_profile_id uuid NOT NULL,
  full_name text NOT NULL,
  birth_date date,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  gender text,
  account_profile_id text,
  CONSTRAINT child_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT child_profiles_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['male'::text, 'female'::text]))))
);
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.course_subscriptions (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  package_id text NOT NULL,
  user_id uuid NOT NULL,
  participant_type text NOT NULL,
  child_id text,
  status text DEFAULT 'pending'::text NOT NULL,
  started_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  amount numeric(10,2),
  transaction_reference text,
  preferred_instructor_id text,
  payment_reference text DEFAULT next_payment_reference(),
  payment_method text,
  payment_receipt_url text,
  preferred_slot jsonb,
  gift_message text,
  recording_consent_at timestamp with time zone,
  CONSTRAINT course_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT course_subscriptions_participant_type_check CHECK ((participant_type = ANY (ARRAY['self'::text, 'child'::text]))),
  CONSTRAINT course_subscriptions_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['instapay'::text, 'vodafone_cash'::text])))),
  CONSTRAINT course_subscriptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'awaiting_verification'::text, 'active'::text, 'completed'::text, 'cancelled'::text]))),
  CONSTRAINT participant_type_child_id_check CHECK ((((participant_type = 'self'::text) AND (child_id IS NULL)) OR ((participant_type = 'child'::text) AND (child_id IS NOT NULL))))
);
ALTER TABLE public.course_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.creative_writing_packages (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  age_group age_group NOT NULL,
  price numeric NOT NULL,
  duration_text text,
  sessions_count integer,
  session_duration text,
  target_audience text,
  prerequisite_note text,
  prerequisite_package_id text,
  short_description text,
  full_description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  track text,
  CONSTRAINT creative_writing_packages_pkey PRIMARY KEY (id),
  CONSTRAINT creative_writing_packages_slug_key UNIQUE (slug),
  CONSTRAINT creative_writing_packages_track_check CHECK (((track IS NULL) OR (track = ANY (ARRAY['foundation'::text, 'youth'::text, 'specialization'::text]))))
);
ALTER TABLE public.creative_writing_packages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dependent_requests (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  child_profile_id text NOT NULL,
  guardian_profile_id uuid NOT NULL,
  requester_profile_id uuid,
  kind text NOT NULL,
  service_id text,
  provider_id text,
  package_id text,
  instructor_id text,
  preferred_slot jsonb,
  note text,
  status text DEFAULT 'pending'::text NOT NULL,
  guardian_note text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  requested_name text,
  CONSTRAINT dependent_requests_pkey PRIMARY KEY (id),
  CONSTRAINT dependent_requests_kind_check CHECK ((kind = ANY (ARRAY['service'::text, 'package'::text, 'name_change'::text]))),
  CONSTRAINT dependent_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]))),
  CONSTRAINT dependent_requests_target_check CHECK ((((kind = 'service'::text) AND (service_id IS NOT NULL) AND (package_id IS NULL) AND (requested_name IS NULL)) OR ((kind = 'package'::text) AND (package_id IS NOT NULL) AND (service_id IS NULL) AND (requested_name IS NULL)) OR ((kind = 'name_change'::text) AND (requested_name IS NOT NULL) AND (btrim(requested_name) <> ''::text) AND (service_id IS NULL) AND (package_id IS NULL))))
);
ALTER TABLE public.dependent_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.instructor_certifications (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  instructor_id text NOT NULL,
  training_completed_at timestamp with time zone,
  training_meeting_link text,
  exam_passed boolean DEFAULT false NOT NULL,
  exam_score integer,
  certified_at timestamp with time zone,
  CONSTRAINT instructor_certifications_pkey PRIMARY KEY (id),
  CONSTRAINT instructor_certifications_instructor_unique UNIQUE (instructor_id)
);
ALTER TABLE public.instructor_certifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.instructor_media (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  instructor_id text NOT NULL,
  kind text NOT NULL,
  image_url text NOT NULL,
  title text,
  contribution text,
  sort_order integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  admin_feedback text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT instructor_media_pkey PRIMARY KEY (id),
  CONSTRAINT instructor_media_kind_check CHECK ((kind = ANY (ARRAY['cover'::text, 'work'::text]))),
  CONSTRAINT instructor_media_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);
ALTER TABLE public.instructor_media ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.instructor_media IS 'صور بروفايل المدرب (غلاف وأعمال) بموافقة الإدارة. اتعملت جدولًا مستقلًا بدل عمود على instructors عشان الصفحات العامة بتقرا من دوال TABLE(...) وتعديلها بيستلزم DROP — وصفاتها مش مقيسة (ملف 127).';

CREATE TABLE public.instructor_packages (
  instructor_id text NOT NULL,
  package_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT instructor_packages_pkey PRIMARY KEY (instructor_id, package_id)
);
ALTER TABLE public.instructor_packages ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.instructor_packages IS 'الباقات اللي المدرب بيدرّبها. **الصفوف الفاضية معناها كل الباقات** — مش ولا باقة (ملف 102).';

CREATE TABLE public.instructor_payouts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  instructor_id text NOT NULL,
  period text NOT NULL,
  amount integer NOT NULL,
  status payout_status_enum DEFAULT 'pending'::payout_status_enum NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  source_type text,
  source_id text,
  description text,
  CONSTRAINT instructor_payouts_pkey PRIMARY KEY (id)
);
ALTER TABLE public.instructor_payouts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.instructor_pricing (
  instructor_id text NOT NULL,
  approved_price integer,
  requested_price integer,
  monthly_hours_committed integer,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT instructor_pricing_pkey PRIMARY KEY (instructor_id)
);
ALTER TABLE public.instructor_pricing ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.instructor_pricing IS 'تسعير داخلي بين المنصة والمدرب. اتفصل عن instructors لأن السياسة هناك USING(true) لكل مسجَّل — والصلاحيات بتحمي الصفوف لا الأعمدة.';

CREATE TABLE public.instructor_pricing_options (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  label text NOT NULL,
  base_price_per_session numeric NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  CONSTRAINT instructor_pricing_options_pkey PRIMARY KEY (id)
);
ALTER TABLE public.instructor_pricing_options ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.instructors (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  bio text NOT NULL,
  specialties text[] NOT NULL,
  years_experience integer NOT NULL,
  is_sample boolean DEFAULT false,
  status instructor_status_enum DEFAULT 'pending_training'::instructor_status_enum NOT NULL,
  training_passed boolean DEFAULT false,
  work_model work_model_enum DEFAULT 'per_session'::work_model_enum NOT NULL,
  selected_pricing_option_id text,
  weekly_schedule jsonb,
  pending_schedule jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT instructors_pkey PRIMARY KEY (id)
);
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.join_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  applicant_name text NOT NULL,
  requested_role text NOT NULL,
  status join_request_status_enum DEFAULT 'pending'::join_request_status_enum NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  email text,
  phone text,
  portfolio_url text,
  message text,
  CONSTRAINT join_requests_pkey PRIMARY KEY (id),
  CONSTRAINT join_requests_requested_role_check CHECK ((requested_role = ANY (ARRAY['instructor'::text, 'publisher'::text])))
);
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  recipient_profile_id text NOT NULL,
  title text NOT NULL,
  message text,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  link text,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  product_id text NOT NULL,
  quantity integer NOT NULL,
  unit_price integer NOT NULL,
  customization_data jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  publisher_id_snapshot text,
  publisher_cost_snapshot integer,
  format text DEFAULT 'printed'::text NOT NULL,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_format_check CHECK ((format = ANY (ARRAY['printed'::text, 'electronic'::text, 'both'::text]))),
  CONSTRAINT order_items_publisher_cost_snapshot_positive CHECK (((publisher_cost_snapshot IS NULL) OR (publisher_cost_snapshot > 0)))
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  dependent_participant_id text,
  independent_participant_id text,
  total_amount integer NOT NULL,
  status order_status_enum DEFAULT 'pending'::order_status_enum NOT NULL,
  transaction_reference text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  recipient_name text,
  recipient_phone text,
  address_line text,
  city text,
  governorate text,
  shipping_notes text,
  shipping_fee numeric DEFAULT 0 NOT NULL,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  tracking_reference text,
  admin_notes text,
  payment_reference text DEFAULT next_payment_reference(),
  payment_method text,
  payment_receipt_url text,
  delivery_email text,
  electronic_sent_at timestamp with time zone,
  box_plan_id text,
  box_details jsonb,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['instapay'::text, 'vodafone_cash'::text]))))
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.page_content (
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by text,
  CONSTRAINT page_content_pkey PRIMARY KEY (key)
);
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.personalized_products (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  category product_category NOT NULL,
  price numeric NOT NULL,
  electronic_price numeric,
  short_description text,
  cover_image_url text,
  publisher_id text,
  owner_type owner_type DEFAULT 'platform'::owner_type NOT NULL,
  features text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  publisher_cost integer,
  is_active boolean DEFAULT true NOT NULL,
  review_status text DEFAULT 'pending'::text NOT NULL,
  review_note text,
  reviewed_at timestamp with time zone,
  gallery_image_urls text[],
  long_description text,
  min_age smallint,
  max_age smallint,
  previous_slugs text[] DEFAULT '{}'::text[] NOT NULL,
  CONSTRAINT personalized_products_pkey PRIMARY KEY (id),
  CONSTRAINT personalized_products_slug_key UNIQUE (slug),
  CONSTRAINT personalized_products_age_order CHECK (((max_age IS NULL) OR ((min_age IS NOT NULL) AND (min_age <= max_age)))),
  CONSTRAINT personalized_products_max_age_range CHECK (((max_age IS NULL) OR ((max_age >= 0) AND (max_age <= 20)))),
  CONSTRAINT personalized_products_min_age_range CHECK (((min_age IS NULL) OR ((min_age >= 0) AND (min_age <= 20)))),
  CONSTRAINT personalized_products_review_status_check CHECK ((review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);
ALTER TABLE public.personalized_products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.portfolio_documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  status document_status_enum DEFAULT 'draft'::document_status_enum NOT NULL,
  instructor_feedback text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT portfolio_documents_pkey PRIMARY KEY (id)
);
ALTER TABLE public.portfolio_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pricing_formula_settings (
  id text DEFAULT 'default'::text NOT NULL,
  platform_multiplier numeric DEFAULT 1 NOT NULL,
  fixed_admin_fee numeric DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT pricing_formula_settings_pkey PRIMARY KEY (id)
);
ALTER TABLE public.pricing_formula_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profile_update_requests (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  instructor_id text NOT NULL,
  requested_changes jsonb NOT NULL,
  status update_request_status DEFAULT 'pending'::update_request_status NOT NULL,
  admin_feedback text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT profile_update_requests_pkey PRIMARY KEY (id)
);
ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.provider_services (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  provider_id text NOT NULL,
  service_id text NOT NULL,
  requested_price numeric,
  approved_price numeric,
  status text DEFAULT 'pending'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT provider_services_pkey PRIMARY KEY (id),
  CONSTRAINT provider_services_unique UNIQUE (provider_id, service_id),
  CONSTRAINT provider_services_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);
ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.publisher_payouts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  publisher_id text NOT NULL,
  period text NOT NULL,
  amount integer NOT NULL,
  status payout_status_enum DEFAULT 'pending'::payout_status_enum NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  source_type text,
  source_id text,
  description text,
  CONSTRAINT publisher_payouts_pkey PRIMARY KEY (id)
);
ALTER TABLE public.publisher_payouts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.publishers (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  user_id uuid,
  slug text NOT NULL,
  name text NOT NULL,
  logo_url text,
  bio text NOT NULL,
  is_sample boolean DEFAULT false,
  status publisher_status_enum DEFAULT 'pending'::publisher_status_enum NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT publishers_pkey PRIMARY KEY (id),
  CONSTRAINT publishers_slug_key UNIQUE (slug)
);
ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reviews (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  dependent_participant_id text,
  independent_participant_id text,
  instructor_id text NOT NULL,
  rating integer NOT NULL,
  comment text,
  booking_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  reviewer_profile_id text,
  service_order_id text,
  standalone_service_id text,
  service_rating integer,
  is_hidden boolean DEFAULT false NOT NULL,
  hidden_reason text,
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT chk_review_one_participant CHECK ((((dependent_participant_id IS NOT NULL) AND (independent_participant_id IS NULL)) OR ((dependent_participant_id IS NULL) AND (independent_participant_id IS NOT NULL)))),
  CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT reviews_rating_range CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT reviews_service_rating_range CHECK (((service_rating IS NULL) OR ((service_rating >= 1) AND (service_rating <= 5))))
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.service_order_messages (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  order_id text NOT NULL,
  sender_profile_id text NOT NULL,
  body text NOT NULL,
  is_delivery boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT service_order_messages_pkey PRIMARY KEY (id),
  CONSTRAINT service_order_messages_body_check CHECK ((length(TRIM(BOTH FROM body)) > 0))
);
ALTER TABLE public.service_order_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.service_orders (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  buyer_profile_id text NOT NULL,
  package_id text,
  standalone_service_id text,
  status service_order_status DEFAULT 'pending'::service_order_status NOT NULL,
  amount numeric NOT NULL,
  transaction_reference text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  instructor_id text,
  delivered_at timestamp with time zone,
  completed_at timestamp with time zone,
  instructor_earning numeric,
  provider_id text,
  due_at timestamp with time zone,
  due_note text,
  due_warned_at timestamp with time zone,
  due_overdue_notified_at timestamp with time zone,
  payment_reference text DEFAULT next_payment_reference(),
  payment_method text,
  payment_receipt_url text,
  participant_type text DEFAULT 'self'::text NOT NULL,
  child_id text,
  CONSTRAINT service_orders_pkey PRIMARY KEY (id),
  CONSTRAINT chk_service_orders_one_target CHECK ((((package_id IS NOT NULL) AND (standalone_service_id IS NULL)) OR ((package_id IS NULL) AND (standalone_service_id IS NOT NULL)))),
  CONSTRAINT service_orders_participant_consistency CHECK ((((participant_type = 'self'::text) AND (child_id IS NULL)) OR ((participant_type = 'child'::text) AND (child_id IS NOT NULL)))),
  CONSTRAINT service_orders_participant_type_check CHECK ((participant_type = ANY (ARRAY['self'::text, 'child'::text]))),
  CONSTRAINT service_orders_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['instapay'::text, 'vodafone_cash'::text]))))
);
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.service_providers (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  kind provider_kind NOT NULL,
  user_id uuid,
  instructor_id text,
  display_name text NOT NULL,
  bio text DEFAULT ''::text NOT NULL,
  avatar_url text,
  status provider_status DEFAULT 'pending'::provider_status NOT NULL,
  is_public boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT service_providers_pkey PRIMARY KEY (id),
  CONSTRAINT service_providers_kind_shape CHECK ((((kind = 'platform'::provider_kind) AND (user_id IS NULL) AND (instructor_id IS NULL)) OR ((kind = 'instructor'::provider_kind) AND (instructor_id IS NOT NULL)) OR ((kind = 'individual'::provider_kind) AND (user_id IS NOT NULL) AND (instructor_id IS NULL))))
);
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.session_attachments (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  booking_id text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  CONSTRAINT session_attachments_pkey PRIMARY KEY (id)
);
ALTER TABLE public.session_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.session_messages (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  booking_id text NOT NULL,
  sender_profile_id text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT session_messages_pkey PRIMARY KEY (id)
);
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.session_reports (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  session_id text NOT NULL,
  instructor_id text NOT NULL,
  attendance text NOT NULL,
  report text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT session_reports_pkey PRIMARY KEY (id),
  CONSTRAINT session_reports_session_id_key UNIQUE (session_id),
  CONSTRAINT session_reports_attendance_check CHECK ((attendance = ANY (ARRAY['present'::text, 'absent'::text])))
);
ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sessions (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  course_subscription_id text NOT NULL,
  instructor_id text,
  session_number integer NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  status text DEFAULT 'scheduled'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone,
  meeting_url text,
  room_name text,
  room_url text,
  recording_id text,
  recording_status text,
  recording_expires_at timestamp with time zone,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_subscription_number_key UNIQUE (course_subscription_id, session_number),
  CONSTRAINT sessions_recording_status_check CHECK (((recording_status IS NULL) OR (recording_status = ANY (ARRAY['pending'::text, 'ready'::text, 'deleted'::text])))),
  CONSTRAINT sessions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text])))
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shipping_rates (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  governorate text NOT NULL,
  fee numeric NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  city text,
  CONSTRAINT shipping_rates_pkey PRIMARY KEY (id),
  CONSTRAINT shipping_rates_area_unique UNIQUE (governorate, city),
  CONSTRAINT shipping_rates_fee_check CHECK ((fee >= (0)::numeric))
);
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.site_settings (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  CONSTRAINT site_settings_pkey PRIMARY KEY (id),
  CONSTRAINT site_settings_key_key UNIQUE (key)
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.standalone_services (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  category text,
  sort_order integer,
  price_type text DEFAULT 'fixed'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  CONSTRAINT standalone_services_pkey PRIMARY KEY (id),
  CONSTRAINT standalone_services_price_type_check CHECK ((price_type = ANY (ARRAY['fixed'::text, 'starts_from'::text])))
);
ALTER TABLE public.standalone_services ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.study_materials (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  title text NOT NULL,
  description text,
  package_id text,
  CONSTRAINT study_materials_pkey PRIMARY KEY (id)
);
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.support_session_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  message text NOT NULL,
  status support_session_status_enum DEFAULT 'pending'::support_session_status_enum NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT support_session_requests_pkey PRIMARY KEY (id)
);
ALTER TABLE public.support_session_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.support_ticket_messages (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  ticket_id text NOT NULL,
  sender_profile_id text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id)
);
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.support_tickets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  requester_name text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL,
  status ticket_status_enum DEFAULT 'open'::ticket_status_enum NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id)
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.testimonials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  author_name text NOT NULL,
  author_role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT testimonials_pkey PRIMARY KEY (id)
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_emails (
  user_id uuid NOT NULL,
  email text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_emails_pkey PRIMARY KEY (user_id)
);
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  role user_role_enum DEFAULT 'visitor'::user_role_enum NOT NULL,
  is_guardian boolean DEFAULT false,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  permissions text[],
  suspended_at timestamp with time zone,
  suspension_reason text,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id)
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.withdrawal_requests (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  instructor_id text,
  amount numeric NOT NULL,
  method text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  payout_details text,
  publisher_id text,
  CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id),
  CONSTRAINT withdrawal_requests_amount_check CHECK ((amount > (0)::numeric)),
  CONSTRAINT withdrawal_requests_owner_check CHECK ((((instructor_id IS NOT NULL) AND (publisher_id IS NULL)) OR ((instructor_id IS NULL) AND (publisher_id IS NOT NULL)))),
  CONSTRAINT withdrawal_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'rejected'::text])))
);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════
-- ٢. الدوال (48)
-- ════════════════════════════════════════════════════════════

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.activate_box_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_months   integer;
  v_sub_id   uuid;
  v_plan     jsonb := NEW.box_details->'plan';
BEGIN
  v_months := greatest(1, coalesce((v_plan->>'months')::integer, 1));

  INSERT INTO box_subscriptions (
    user_id, customer_name, plan_name, status, next_shipment_date,
    order_id, plan_id, months, starts_at, ends_at,
    addon_discount_percent, free_addon_name, details
  )
  VALUES (
    NEW.user_id,
    coalesce(NEW.recipient_name, 'مشترك'),
    coalesce(v_plan->>'name', 'صندوق الرحلة'),
    'active', now(),
    NEW.id, NEW.box_plan_id, v_months, now(), now() + make_interval(months => v_months),
    coalesce((v_plan->>'addonDiscountPercent')::smallint, 0),
    v_plan->>'freeAddonName',
    NEW.box_details
  )
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_sub_id;

  -- اتفعّل قبل كده (الطلب رجع «مدفوع» تاني) = ولا حاجة.
  IF v_sub_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO box_shipments (subscription_id, month_number, goal)
  SELECT v_sub_id, g.n, NEW.box_details->'monthlyGoals'->>(g.n - 1)
    FROM generate_series(1, v_months) AS g(n);

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.apply_dependent_name_change(p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user    uuid := auth.uid();
  v_req     record;
  v_account text;
  v_name    text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول';
  END IF;

  SELECT r.id, r.child_profile_id, r.guardian_profile_id, r.kind,
         r.status, r.requested_name
    INTO v_req
    FROM dependent_requests r
   WHERE r.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب مش موجود';
  END IF;

  -- ولي الأمر صاحب الطلب وحده — ولا حتى الإدارة، ده قرار عائلي.
  IF v_req.guardian_profile_id <> v_user THEN
    RAISE EXCEPTION 'الطلب ده مش على حسابك';
  END IF;

  IF v_req.kind <> 'name_change' THEN
    RAISE EXCEPTION 'الطلب ده مش طلب تغيير اسم';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'الطلب ده اتبتّ فيه خلاص';
  END IF;

  v_name := btrim(v_req.requested_name);
  IF v_name = '' OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'الاسم المطلوب مش صالح';
  END IF;

  -- ① اسم المركز العائلي — ده اللي بيتطبع وبيشوفه المدرب.
  UPDATE child_profiles
     SET full_name = v_name
   WHERE id = v_req.child_profile_id
     AND user_profile_id = v_user
  RETURNING account_profile_id INTO v_account;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ملف الطفل مش على حسابك';
  END IF;

  -- ② اسم حساب الطالب — عشان يشوف نفس الاسم في لوحته.
  --    ⚠️ ده اللي محتاج `SECURITY DEFINER`: ولي الأمر ممنوع من
  --       `user_profiles` بتاع غيره.
  IF NULLIF(btrim(coalesce(v_account, '')), '') IS NOT NULL THEN
    UPDATE user_profiles
       SET full_name = v_name
     WHERE id::text = v_account;
  END IF;

  -- ③ الطلب نفسه.
  UPDATE dependent_requests
     SET status = 'approved', decided_at = now()
   WHERE id = p_request_id
     AND status = 'pending';

  RETURN jsonb_build_object('ok', true, 'name', v_name);
END
$function$
;

CREATE OR REPLACE FUNCTION public.block_inactive_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  -- ⚠️ بيقرا بصلاحية صاحب الدالة. لو قرا بصلاحية المشتري وسياسة
  --    القراءة اتضيّقت يومًا، الصف بيرجع **فاضي لا خطأ** (قاعدة
  --    «ك») — والفحص بيعدّي دايمًا وهو شكله شغّال.
  SELECT p.name INTO v_name
    FROM public.personalized_products p
   WHERE p.id = NEW.product_id
     AND (p.is_active = false OR p.review_status <> 'approved');

  IF FOUND THEN
    RAISE EXCEPTION 'المنتج «%» مش متاح للطلب دلوقتي', v_name;
  END IF;

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.block_suspended_purchase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  -- اسم عمود المالك بيتبعت وقت ربط المحفّز: orders.user_id،
  -- course_subscriptions.user_id، service_orders.buyer_profile_id.
  --
  -- ⚠️ **`to_jsonb` لا `EXECUTE format(...)`.** الاتنين بيقروا عمودًا
  --    اسمه متغيّر، بس التانية بتبني SQL من نص وقت التشغيل — وده
  --    أوسع مما نحتاج، وبيخلّي الدالة أصعب في القراءة والمراجعة.
  v_owner := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  -- ⚠️ بيقرا بصلاحية صاحب الدالة: المشتري **مش** بيقدر يقرا صفّ
  --    حد تاني، وحتى صفّه هو ممكن ما يتقريش لو السياسة اتغيّرت.
  --    والصفوف الممنوعة بترجع فاضية لا بخطأ (قاعدة «ك») — يعني
  --    الفحص كان هيعدّي دايمًا.
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE id = v_owner AND suspended_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'الحساب ده موقوف عن الشراء. تواصل مع الإدارة.';
  END IF;

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_service_order(p_order_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM service_orders o
    LEFT JOIN instructors i ON i.id = o.instructor_id
    WHERE o.id = p_order_id
      AND (
        o.buyer_profile_id = auth.uid()::text
        OR i.user_id = auth.uid()
        OR public.is_admin()
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_see_dependent_request(p_child_profile_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM child_profiles c
    WHERE c.id = p_child_profile_id
      AND (
        -- ولي الأمر (uuid)
        c.user_profile_id = auth.uid()
        -- أو الطفل نفسه بحسابه (text)
        OR c.account_profile_id = (auth.uid())::text
      )
  ) OR public.is_admin();
$function$
;

CREATE OR REPLACE FUNCTION public.can_see_profile(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- 1) نفسه
    p_id = auth.uid()
    -- 2) الإدارة
    OR public.is_admin()
    -- 3) مدرب أو مقدّم خدمة: اسمه معروض على الموقع أصلًا
    OR EXISTS (SELECT 1 FROM instructors i WHERE i.user_id = p_id)
    OR EXISTS (SELECT 1 FROM service_providers sp WHERE sp.user_id = p_id)
    -- 4) كاتب مراجعة ظاهرة
    OR EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.reviewer_profile_id = p_id::text AND r.is_hidden = false
    )
    -- 5) طرف معاك في طلب خدمة
    OR EXISTS (
      SELECT 1
      FROM service_orders o
      LEFT JOIN service_providers sp2 ON sp2.id = o.provider_id
      LEFT JOIN instructors i2        ON i2.id = o.instructor_id
      WHERE (
              -- إنت المشتري وهو المقدّم
              (o.buyer_profile_id = (auth.uid())::text
               AND (sp2.user_id = p_id OR i2.user_id = p_id))
              -- أو هو المشتري وإنت المقدّم
              OR (o.buyer_profile_id = p_id::text
                  AND (sp2.user_id = auth.uid() OR i2.user_id = auth.uid()))
            )
    )
    -- 6) إنت مدربه
    OR public.instructor_teaches(p_id::text);
$function$
;

CREATE OR REPLACE FUNCTION public.create_box_subscription_order(p_plan_id text, p_details jsonb, p_shipping jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user     uuid := auth.uid();
  v_plan     record;
  v_free     text;
  v_child    text;
  v_fee      numeric;
  v_shipping numeric;
  v_goals    jsonb := '[]'::jsonb;
  v_goal     text;
  v_i        integer;
  v_details  jsonb;
  v_order_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول قبل الاشتراك';
  END IF;

  SELECT id, name, price_total, duration_months, addon_discount_percent, free_addon_id
    INTO v_plan
    FROM box_subscription_plans
   WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الخطة دي مش متاحة';
  END IF;
  IF coalesce(v_plan.duration_months, 0) < 1 OR coalesce(v_plan.price_total, 0) <= 0 THEN
    RAISE EXCEPTION 'الخطة دي ناقصة بياناتها — تواصل معانا';
  END IF;

  v_child := NULLIF(p_details->>'childId', '');
  IF v_child IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM child_profiles c WHERE c.id::text = v_child AND c.user_profile_id = v_user
  ) THEN
    RAISE EXCEPTION 'ملف المشارك المرفق لا يخص صاحب الحساب';
  END IF;

  -- الشحن: سعر المنطقة × عدد الشهور (قرار تامر).
  IF coalesce(btrim(p_shipping->>'governorate'), '') = ''
     OR coalesce(btrim(p_shipping->>'city'), '') = '' THEN
    RAISE EXCEPTION 'عنوان الشحن مطلوب';
  END IF;
  SELECT fee INTO v_fee FROM shipping_rates
   WHERE is_active = true
     AND governorate = btrim(p_shipping->>'governorate')
     AND city        = btrim(p_shipping->>'city')
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'منطقة الشحن دي مش مسجّلة — تواصل معانا';
  END IF;
  v_shipping := v_fee * v_plan.duration_months;

  -- هدف كل شهر: اللي العميل كتبه، والفاضي = «تختاره الإدارة» (NULL).
  -- ⚠️ عدد الأهداف = عدد شهور الخطة **من القاعدة**، مش من الواجهة.
  FOR v_i IN 1..v_plan.duration_months LOOP
    v_goal := NULLIF(left(btrim(coalesce(p_details->'monthlyGoals'->>(v_i - 1), '')), 200), '');
    -- ⚠️ `jsonb_build_array` مش `to_jsonb`: `to_jsonb(NULL)` = NULL، و`|| NULL`
    --    بيمسح المصفوفة كلها — أول شهر فاضي كان بيضيّع أهداف الشهور كلها
    --    (اتمسك في التجربة المحلية).
    v_goals := v_goals || jsonb_build_array(v_goal);
  END LOOP;

  SELECT a.name INTO v_free FROM addon_products a WHERE a.id::text = v_plan.free_addon_id;

  -- ⚠️ بيانات الخطة **منسوخة** في الطلب: لو الإدارة غيّرت السعر أو
  --    الخصم بعدين، الطلب ده بيفضل بشروطه.
  v_details := (coalesce(p_details, '{}'::jsonb) - 'monthlyGoals' - 'addons')
    || jsonb_build_object(
         'monthlyGoals', v_goals,
         'plan', jsonb_build_object(
           'id', v_plan.id, 'name', v_plan.name, 'months', v_plan.duration_months,
           'price', v_plan.price_total, 'shippingPerMonth', v_fee,
           'addonDiscountPercent', v_plan.addon_discount_percent,
           'freeAddonName', v_free
         )
       );

  INSERT INTO orders (
    user_id, total_amount, shipping_fee, status,
    recipient_name, recipient_phone, address_line, city, governorate, shipping_notes,
    box_plan_id, box_details
  )
  VALUES (
    v_user, round(v_plan.price_total + v_shipping), v_shipping, 'pending',
    NULLIF(btrim(coalesce(p_shipping->>'recipientName',  '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'recipientPhone', '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'addressLine',    '')), ''),
    btrim(p_shipping->>'city'),
    btrim(p_shipping->>'governorate'),
    NULLIF(btrim(coalesce(p_shipping->>'notes', '')), ''),
    v_plan.id, v_details
  )
  RETURNING id INTO v_order_id;

  RETURN v_order_id::text;
END
$function$
;

CREATE OR REPLACE FUNCTION public.create_course_booking(p_package_id text, p_instructor_id text DEFAULT NULL::text, p_participant_type text DEFAULT 'self'::text, p_child_id text DEFAULT NULL::text, p_gift_message text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user    uuid := auth.uid();
  v_price   numeric;
  v_child   text := NULLIF(btrim(coalesce(p_child_id, '')), '');
  v_instr   text := NULLIF(btrim(coalesce(p_instructor_id, '')), '');
  -- القصّ في القاعدة مش في المتصفح: الـRPC ممكن تتنادى من غير الشاشة.
  v_gift    text := NULLIF(btrim(coalesce(p_gift_message, '')), '');
  v_id      text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول قبل الحجز';
  END IF;

  -- الباقة لازم تكون موجودة ومفعّلة — مش أي نص جاي في الرابط.
  SELECT price INTO v_price
    FROM creative_writing_packages
   WHERE id = p_package_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الباقة دي مش متاحة';
  END IF;

  -- المدرب اختياري، وبيتقبل بس لو موجود ومفعّل.
  IF v_instr IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM instructors
       WHERE id = v_instr AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'المدرب المختار مش متاح';
    END IF;
  END IF;

  IF p_participant_type = 'child' THEN
    IF v_child IS NULL THEN
      RAISE EXCEPTION 'اختار المشارك الأول';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM child_profiles c
       WHERE c.id = v_child AND c.user_profile_id = v_user
    ) THEN
      RAISE EXCEPTION 'ملف المشارك المرفق لا يخص صاحب الحساب';
    END IF;
  ELSE
    v_child := NULL;
  END IF;

  IF v_gift IS NOT NULL THEN
    v_gift := left(v_gift, 500);
  END IF;

  INSERT INTO course_subscriptions (
    package_id, user_id, participant_type, child_id,
    status, amount, preferred_instructor_id, gift_message
  )
  VALUES (
    p_package_id, v_user, p_participant_type, v_child,
    'pending', v_price, v_instr, v_gift
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END
$function$
;

CREATE OR REPLACE FUNCTION public.create_customer_order(p_items jsonb, p_shipping jsonb DEFAULT NULL::jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user           uuid    := auth.uid();
  v_order_id       uuid;
  v_item           jsonb;
  v_line           jsonb;
  v_product        record;
  v_addon          record;
  v_addon_id       text;
  v_addon_custom   boolean;
  v_addon_price    numeric;
  v_qty            integer;
  v_child          text;
  v_unit           numeric;
  v_addons_total   numeric;
  v_addons_count   integer;
  v_addons_snap    jsonb;
  v_customization  jsonb;
  v_format         text;
  v_base           numeric;
  v_subtotal       numeric := 0;
  v_shipping       numeric := 0;
  v_needs_shipping boolean := false;
  v_has_electronic boolean := false;
  v_email          text;
  -- ⭐ ملف 140: خصم المشترك على الإضافات (أعلى نسبة لو عنده أكتر من اشتراك)
  v_discount       integer := 0;
  v_lines          jsonb   := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول قبل الطلب';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الطلب فاضي';
  END IF;

  -- ⭐ ملف 140: المشترك في صندوق الرحلة ليه خصم على الإضافات طول مدة
  --    اشتراكه. الاشتراك **مايتعملش غير بعد تأكيد الدفع** (محفّز
  --    `activate_box_subscription`) — فالعميل مايقدرش يدّي نفسه الخصم.
  SELECT coalesce(max(s.addon_discount_percent), 0)
    INTO v_discount
    FROM box_subscriptions s
   WHERE s.user_id = v_user
     AND s.status = 'active'
     AND s.ends_at > now();

  -- ══ الدورة الأولى: تسعير وتحقّق، بلا أي كتابة ═══════════
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));

    v_format := coalesce(NULLIF(btrim(v_item->>'format'), ''), 'printed');
    IF v_format NOT IN ('printed', 'electronic', 'both') THEN
      RAISE EXCEPTION 'نوع النسخة غير معروف: %', v_format;
    END IF;

    SELECT p.id, p.price, p.category, p.electronic_price
      INTO v_product
      FROM personalized_products p
     WHERE p.id::text = v_item->>'product_id';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'منتج غير موجود: %', v_item->>'product_id';
    END IF;

    -- ⚠️ **القاعدة هي الحارس**، مش الشاشة: طلب إلكتروني لمنتج مكتبة
    --    أو لمنتج مالوش سعر إلكتروني بيترفض هنا مهما الواجهة بعتت.
    IF v_format <> 'printed' THEN
      IF v_product.category <> 'custom'
         OR coalesce(v_product.electronic_price, 0) <= 0 THEN
        RAISE EXCEPTION 'النسخة الإلكترونية مش متاحة للمنتج ده';
      END IF;
      v_has_electronic := true;
      v_qty := 1;
    END IF;

    v_child := NULLIF(v_item->'customization_data'->>'childId', '');
    IF v_child IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM child_profiles c
         WHERE c.id::text = v_child AND c.user_profile_id = v_user
      ) THEN
        RAISE EXCEPTION 'ملف المشارك المرفق لا يخص صاحب الحساب';
      END IF;
    END IF;

    -- الإضافات: أرقامها بس هي اللي بتيجي من الواجهة، والسعر من الجدول.
    v_addons_total := 0;
    v_addons_count := 0;
    v_addons_snap  := '[]'::jsonb;

    IF jsonb_typeof(v_item->'addon_ids') = 'array' THEN
      FOR v_addon_id IN
        SELECT jsonb_array_elements_text(v_item->'addon_ids')
      LOOP
        SELECT a.id, a.name, a.price,
               a.supports_customization, a.customization_price
          INTO v_addon
          FROM addon_products a
         WHERE a.id = v_addon_id AND a.is_active = true;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'إضافة غير متاحة: %', v_addon_id;
        END IF;

        v_addon_custom := coalesce(
          jsonb_exists(v_item->'customized_addon_ids', v_addon_id),
          false
        );

        IF v_addon_custom AND NOT v_addon.supports_customization THEN
          RAISE EXCEPTION 'الإضافة «%» مبتقبلش تخصيص', v_addon.name;
        END IF;

        v_addon_price := v_addon.price
          + CASE WHEN v_addon_custom THEN v_addon.customization_price ELSE 0 END;
        -- ⭐ ملف 140: الخصم بيتقرّب لجنيه — إجمالي الطلب عمود صحيح.
        IF v_discount > 0 THEN
          v_addon_price := round(v_addon_price * (100 - v_discount) / 100.0);
        END IF;

        v_addons_total := v_addons_total + v_addon_price;
        v_addons_count := v_addons_count + 1;
        v_addons_snap  := v_addons_snap || jsonb_build_object(
          'id',    v_addon.id,
          'name',  v_addon.name,
          'price', v_addon_price,
          'customized', v_addon_custom,
          'discount_percent', v_discount
        );
      END LOOP;
    END IF;

    -- الشحن: أي حاجة ملموسة — نسخة مطبوعة **أو إضافة** (قرار تامر:
    -- الإضافة مع الإلكتروني بتتشحن). والاشتراك زي ما كان.
    IF v_product.category <> 'subscription'
       AND (v_format <> 'electronic' OR v_addons_count > 0) THEN
      v_needs_shipping := true;
    END IF;

    v_base := CASE v_format
      WHEN 'printed'    THEN v_product.price
      WHEN 'electronic' THEN v_product.electronic_price
      ELSE v_product.price + v_product.electronic_price
    END;
    v_unit := v_base + v_addons_total;

    v_customization := coalesce(v_item->'customization_data', '{}'::jsonb)
                       || jsonb_build_object('addons', v_addons_snap);

    v_lines := v_lines || jsonb_build_object(
      'product_id',    v_product.id::text,
      'quantity',      v_qty,
      'unit_price',    v_unit,
      'format',        v_format,
      'customization', v_customization
    );

    v_subtotal := v_subtotal + (v_unit * v_qty);
  END LOOP;

  -- ══ إيميل الاستلام ═════════════════════════════════════
  IF v_has_electronic THEN
    v_email := lower(btrim(coalesce(p_shipping->>'deliveryEmail', '')));
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254 THEN
      RAISE EXCEPTION 'اكتب الإيميل اللي هتستلم عليه النسخة الإلكترونية';
    END IF;
  END IF;

  -- ══ الشحن ══════════════════════════════════════════════
  IF v_needs_shipping THEN
    IF coalesce(btrim(p_shipping->>'governorate'), '') = ''
       OR coalesce(btrim(p_shipping->>'city'), '') = '' THEN
      RAISE EXCEPTION 'عنوان الشحن مطلوب';
    END IF;

    SELECT fee INTO v_shipping
      FROM shipping_rates
     WHERE is_active = true
       AND governorate = btrim(p_shipping->>'governorate')
       AND city        = btrim(p_shipping->>'city')
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'منطقة الشحن دي مش مسجّلة — تواصل معانا';
    END IF;
  END IF;

  -- ══ الطلب: بالإجمالي النهائي من أول لحظة (ملف 108) ═════
  -- ⚠️ العنوان بيتحفظ **بس لو فيه شحن** — طلب إلكتروني لوحده مالوش
  --    عنوان، وحفظ عنوان مالوش لازمة بيلخبط الإدارة («أشحن لمين؟»).
  INSERT INTO orders (
    user_id, total_amount, shipping_fee, status,
    recipient_name, recipient_phone, address_line, city, governorate, shipping_notes,
    delivery_email
  )
  VALUES (
    v_user, v_subtotal + v_shipping, v_shipping, 'pending',
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'recipientName',  '')), '') END,
    -- التليفون بيتحفظ دايمًا: الإدارة محتاجاه للتواصل حتى من غير شحن.
    NULLIF(btrim(coalesce(p_shipping->>'recipientPhone', '')), ''),
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'addressLine',    '')), '') END,
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'city',           '')), '') END,
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'governorate',    '')), '') END,
    NULLIF(btrim(coalesce(p_shipping->>'notes', '')), ''),
    CASE WHEN v_has_electronic THEN v_email END
  )
  RETURNING id INTO v_order_id;

  -- ══ البنود ═════════════════════════════════════════════
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, customization_data, format)
    VALUES (
      v_order_id,
      (v_line->>'product_id')::uuid,
      (v_line->>'quantity')::integer,
      (v_line->>'unit_price')::numeric,
      v_line->'customization',
      v_line->>'format'
    );
  END LOOP;

  RETURN v_order_id::text;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_course_subscription_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.user_id                 := OLD.user_id;
  NEW.package_id              := OLD.package_id;
  NEW.child_id                := OLD.child_id;
  NEW.participant_type        := OLD.participant_type;
  NEW.started_at              := OLD.started_at;
  -- الفلوس والمدرب المعتمد: العميل ما بيلمسهمش.
  NEW.amount                  := OLD.amount;
  NEW.preferred_instructor_id := OLD.preferred_instructor_id;
  -- الإهداء بيتكتب مرة واحدة مع الحجز — جزء من المنفَّذ زي المبلغ.
  NEW.gift_message            := OLD.gift_message;

  -- الانتقال الوحيد المسموح للعميل: «حوّلت» + رقم التحويل معاه.
  IF OLD.status = 'pending' AND NEW.status = 'awaiting_verification' THEN
    NEW.transaction_reference := NEW.transaction_reference;
  ELSE
    NEW.status                := OLD.status;
    NEW.transaction_reference := OLD.transaction_reference;
  END IF;

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_instructor_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() بتبقى فاضية في حالتين: طلب مجهول (وده بترفضه الصلاحيات
  -- قبل ما يوصل هنا)، أو مفتاح الخدمة اللي الإدارة بتستخدمه. والإداري
  -- مسموح له صراحة. غير كده: الأعمدة الإدارية بترجع زي ما كانت.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.user_id                    := OLD.user_id;
  NEW.status                     := OLD.status;
  NEW.training_passed            := OLD.training_passed;
  NEW.selected_pricing_option_id := OLD.selected_pricing_option_id;
  NEW.weekly_schedule            := OLD.weekly_schedule;
  NEW.is_sample                  := OLD.is_sample;

  -- ⚠️ الأربعة دول اتضافوا في ملف 127. كانوا مفتوحين للمدرب
  --    يكتبهم مباشرةً بينما الشاشة بتبعت طلب موافقة — يعني
  --    الموافقة كانت اختيارية لمن يعرف. الطريق الوحيد دلوقتي هو
  --    جدول الطلبات، وهو اللي الشاشة بتستعمله أصلًا.
  NEW.display_name               := OLD.display_name;
  NEW.bio                        := OLD.bio;
  NEW.specialties                := OLD.specialties;
  NEW.years_experience           := OLD.years_experience;

  -- ملاحظة: أعمدة التسعير اتنقلت لجدول `instructor_pricing`
  -- (ملف 122) واتشالت من هنا في ملف 123. الحماية بقت في سياسة
  -- الكتابة هناك — وهي أقوى من الحارس ده: الحارس بيرجّع القيمة
  -- القديمة في صمت، والسياسة بترفض الكتابة من أصلها.
  --
  -- والأسماء مش مكتوبة هنا عن قصد: أي فحص بيدوّر عليها في نصّ
  -- الدالة كان بيلاقيها في التعليق ويطلّع إنذارًا كاذبًا.

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_instructor_media()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- فاضية = مفتاح الخدمة · والإداري مسموح له صراحةً.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- المدرب مايقررش الحالة ولا يكتب ملاحظات الإدارة.
  NEW.status         := OLD.status;
  NEW.admin_feedback := OLD.admin_feedback;
  NEW.instructor_id  := OLD.instructor_id;
  NEW.kind           := OLD.kind;

  -- ⚠️ **والصورة لو اتغيّرت، الختم بيسقط.**
  IF NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.contribution IS DISTINCT FROM OLD.contribution
  THEN
    NEW.status         := 'pending';
    NEW.admin_feedback := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_order_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- الاستثناء الوحيد: العميل يقول «حوّلت» ويسيب وسيلة الدفع والإيصال.
  IF OLD.status = 'pending'
     AND NEW.status = 'awaiting_verification' THEN
    NULL;
  ELSE
    NEW.status              := OLD.status;
    NEW.payment_method      := OLD.payment_method;
    NEW.payment_receipt_url := OLD.payment_receipt_url;
  END IF;

  -- الفلوس والملكية والرقم المرجعي: العميل ما بيلمسهمش أبدًا.
  NEW.id                    := OLD.id;
  NEW.user_id               := OLD.user_id;
  NEW.total_amount          := OLD.total_amount;
  NEW.shipping_fee          := OLD.shipping_fee;
  NEW.created_at            := OLD.created_at;
  NEW.payment_reference     := OLD.payment_reference;
  NEW.transaction_reference := OLD.transaction_reference;

  -- التنفيذ والشحن: الإدارة وحدها.
  NEW.shipped_at         := OLD.shipped_at;
  NEW.delivered_at       := OLD.delivered_at;
  NEW.tracking_reference := OLD.tracking_reference;
  NEW.admin_notes        := OLD.admin_notes;
  NEW.electronic_sent_at := OLD.electronic_sent_at;   -- ملف 138
  -- ⭐ ملف 140: طلب الاشتراك مايتحوّلش لطلب عادي ولا العكس، وتفاصيله
  --    (الخطة، الشهور، الأهداف) بتتقفل بالسعر اللي اتحسب عليها.
  NEW.box_plan_id        := OLD.box_plan_id;
  NEW.box_details        := OLD.box_details;

  -- عنوان الشحن وإيميل الاستلام مفتوحين عن قصد: العميل يصحّحهم قبل التنفيذ.

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_order_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- أي طلب جديد من عميل يبدأ «قيد الانتظار»، ومن غير بيانات تنفيذ.
  NEW.status             := 'pending';
  NEW.shipped_at         := NULL;
  NEW.delivered_at       := NULL;
  NEW.tracking_reference := NULL;
  NEW.admin_notes        := NULL;

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_portfolio_document_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- المدرب والإدارة ومفتاح الخدمة: مسموح لهم بالكامل (التصحيح شغلهم).
  IF auth.uid() IS NULL OR public.is_admin() OR public.is_instructor() THEN
    RETURN NEW;
  END IF;

  NEW.student_id          := OLD.student_id;
  NEW.instructor_feedback := OLD.instructor_feedback;

  -- الطالب بيحفظ مسودة أو يسلّم — مش بيراجع نفسه.
  IF NEW.status NOT IN ('draft', 'submitted') THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_product_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- فاضية = مفتاح الخدمة · والإداري هو المُوافِق.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    -- ختم وقت الاعتماد لما الإداري يعتمد.
    IF TG_OP = 'UPDATE'
       AND NEW.review_status = 'approved'
       AND OLD.review_status IS DISTINCT FROM 'approved' THEN
      NEW.reviewed_at := now();
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- ⚠️ الناشر مايقررش إنه معتمد. السياسة بتفحص ده كمان —
    --    والاتنين لازمين: السياسة بتقفل الإدراج، والحارس بيقفل
    --    التعديل.
    NEW.review_status := 'pending';
    NEW.review_note   := NULL;
    NEW.reviewed_at   := NULL;
    NEW.updated_at    := now();
    RETURN NEW;
  END IF;

  -- ══ تعديل من غير إداري ═══════════════════════════════
  --
  -- ⚠️ **الحالة بترجع «في الانتظار» مهما كان اللي اتغيّر.**
  --    مافيش قايمة حقول هنا عن قصد: القايمة بتنسى حقلًا، والنسيان
  --    معناه «وافق على الصفّ وبدّل المحتوى».
  NEW.review_status := 'pending';
  NEW.review_note   := OLD.review_note;
  NEW.reviewed_at   := OLD.reviewed_at;

  -- وحاجات مش بتاعته أصلًا.
  NEW.owner_type    := OLD.owner_type;
  NEW.publisher_id  := OLD.publisher_id;
  NEW.is_active     := OLD.is_active;
  NEW.slug          := OLD.slug;

  NEW.updated_at := now();
  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_provider_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() فاضي = استدعاء بمفتاح الخدمة من الخادم، والمجهول
  -- مرفوض أصلًا بالصلاحيات. فالحالتين دول آمنين.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- المقدّم يعدّل اسمه ونبذته وصورته. الباقي للإدارة.
  NEW.kind          := OLD.kind;
  NEW.status        := OLD.status;
  NEW.is_public     := OLD.is_public;
  NEW.user_id       := OLD.user_id;
  NEW.instructor_id := OLD.instructor_id;
  NEW.created_at    := OLD.created_at;
  NEW.updated_at    := now();
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.guard_provider_service_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- عرض جديد من مقدّم = اقتراح. مش معتمد ومش بسعر معتمد.
    NEW.status         := 'pending';
    NEW.approved_price := NULL;
    NEW.admin_notes    := NULL;
    RETURN NEW;
  END IF;

  -- تعديل: السعر المعتمد وحالة الاعتماد وملاحظات الإدارة مالهمش دعوة
  -- بالمقدّم. هو يقدر يغيّر سعره المطلوب ويوقف عرضه مؤقتًا.
  NEW.status         := OLD.status;
  NEW.approved_price := OLD.approved_price;
  NEW.admin_notes    := OLD.admin_notes;
  NEW.provider_id    := OLD.provider_id;
  NEW.service_id     := OLD.service_id;
  NEW.created_at     := OLD.created_at;
  NEW.updated_at     := now();
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.guard_publisher_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.user_id   := OLD.user_id;
  NEW.status    := OLD.status;
  -- الرابط جزء من هوية الناشر العامة، وتغييره بيكسر روابط قايمة.
  NEW.slug      := OLD.slug;
  NEW.is_sample := OLD.is_sample;

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_service_order_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_the_provider BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- مقدّم الخدمة المكلَّف: مدرب بالطريقة القديمة، أو مقدّم بالجديدة.
  SELECT EXISTS (
    SELECT 1 FROM instructors i
    WHERE i.id = OLD.instructor_id AND i.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM service_providers sp
    LEFT JOIN instructors i2 ON i2.id = sp.instructor_id
    WHERE sp.id = OLD.provider_id
      AND (sp.user_id = auth.uid() OR i2.user_id = auth.uid())
  ) INTO is_the_provider;

  IF TG_OP = 'INSERT' THEN
    NEW.status             := 'pending';
    NEW.instructor_earning := NULL;
    NEW.delivered_at       := NULL;
    NEW.completed_at       := NULL;
    NEW.due_at             := NULL;
    NEW.due_note           := NULL;
    -- الدفع ما بيتسجّلش وقت إنشاء الطلب.
    NEW.payment_method      := NULL;
    NEW.payment_receipt_url := NULL;
    RETURN NEW;
  END IF;

  IF is_the_provider THEN
    -- مقدّم الخدمة: من «قيد التنفيذ» إلى «سُلّم» وبس.
    IF NOT (OLD.status = 'in_progress' AND NEW.status = 'delivered') THEN
      NEW.status := OLD.status;
    END IF;
    NEW.transaction_reference := OLD.transaction_reference;
    NEW.payment_method        := OLD.payment_method;
    NEW.payment_receipt_url   := OLD.payment_receipt_url;
  ELSE
    -- المشتري: انتقالان مسموحان — «حوّلت»، و«استلمت وأأكّد».
    IF OLD.status = 'pending' AND NEW.status = 'awaiting_verification' THEN
      NULL;
    ELSIF OLD.status = 'delivered' AND NEW.status = 'completed' THEN
      NEW.payment_method        := OLD.payment_method;
      NEW.payment_receipt_url   := OLD.payment_receipt_url;
    ELSE
      NEW.status                := OLD.status;
      NEW.transaction_reference := OLD.transaction_reference;
      NEW.payment_method        := OLD.payment_method;
      NEW.payment_receipt_url   := OLD.payment_receipt_url;
    END IF;
  END IF;

  -- الفلوس والأطراف والمهلة والرقم المرجعي: محدش غير الإدارة.
  NEW.id                    := OLD.id;
  NEW.buyer_profile_id      := OLD.buyer_profile_id;
  NEW.instructor_id         := OLD.instructor_id;
  NEW.provider_id           := OLD.provider_id;
  NEW.amount                := OLD.amount;
  NEW.instructor_earning    := OLD.instructor_earning;
  NEW.package_id            := OLD.package_id;
  NEW.standalone_service_id := OLD.standalone_service_id;
  NEW.created_at            := OLD.created_at;
  NEW.due_at                := OLD.due_at;
  NEW.due_note              := OLD.due_note;
  NEW.payment_reference     := OLD.payment_reference;

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_session_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- `auth.uid() IS NULL` معناها إن التعديل جاي من الخادم بمفتاح الخدمة
  -- (إنشاء الغرفة، ومهمة حذف التسجيلات). والزائر المجهول بترفضه RLS
  -- قبل ما يوصل هنا أصلًا. والإدارة ليها حق التعديل الكامل.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- المدرب بيعدّل الموعد والحالة ورابط اللقاء وبس. الباقي بيترجّع
  -- لقيمته القديمة بصمت — مش بنرمي خطأ، عشان تعديل عادي فيه عمود
  -- محمي ما يفشلش كله.
  NEW.id                     := OLD.id;
  NEW.course_subscription_id := OLD.course_subscription_id;
  NEW.instructor_id          := OLD.instructor_id;
  NEW.session_number         := OLD.session_number;
  NEW.created_at             := OLD.created_at;

  -- ⚠️ **الجديد: الغرفة والتسجيل.**
  --
  --    من غير السطور دي، المدرب كان يقدر يغيّر رابط الغرفة فيودّي
  --    الطالب لمكان تاني، أو يقدّم موعد حذف التسجيل فيمسح الدليل
  --    اللي المفروض يتراجع لو حصلت عليه شكوى.
  NEW.room_name              := OLD.room_name;
  NEW.room_url               := OLD.room_url;
  NEW.recording_id           := OLD.recording_id;
  NEW.recording_status       := OLD.recording_status;
  NEW.recording_expires_at   := OLD.recording_expires_at;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_suspension_target()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.suspended_at IS NOT NULL
     AND NEW.role IN ('super_admin', 'general_supervisor')
  THEN
    RAISE EXCEPTION 'مينفعش توقف حساب إداري';
  END IF;
  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_user_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() فاضي = التعديل جاي من السيرفر (service role)، مش من متصفح.
  -- والمستخدم المجهول متمنوع أصلًا بالـ RLS قبل ما يوصل هنا.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.role        := OLD.role;
  NEW.permissions := OLD.permissions;

  -- ⚠️ **الجديد: الإيقاف.**
  --
  --    من غير السطرين دول، الموقوف بيفكّ إيقاف نفسه بنداء واحد من
  --    متصفحه — سياسة «المستخدم يعدّل صفّه» بتسمح بالصف، والصلاحيات
  --    مابتحرسش الأعمدة (قاعدة «ب»).
  NEW.suspended_at      := OLD.suspended_at;
  NEW.suspension_reason := OLD.suspension_reason;

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_withdrawal_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_available numeric := 0;
  v_open      integer := 0;
BEGIN
  -- الحالة الابتدائية مش اختيارية.
  NEW.status := 'pending';

  IF NEW.instructor_id IS NOT NULL THEN
    SELECT COALESCE(sum(amount), 0) INTO v_available
      FROM instructor_payouts
     WHERE instructor_id = NEW.instructor_id
       AND status = 'pending';

    SELECT count(*) INTO v_open
      FROM withdrawal_requests
     WHERE instructor_id = NEW.instructor_id
       AND status = 'pending';

  ELSIF NEW.publisher_id IS NOT NULL THEN
    SELECT COALESCE(sum(amount), 0) INTO v_available
      FROM publisher_payouts
     WHERE publisher_id = NEW.publisher_id
       AND status = 'pending';

    SELECT count(*) INTO v_open
      FROM withdrawal_requests
     WHERE publisher_id = NEW.publisher_id
       AND status = 'pending';

  ELSE
    -- القيد بتاع القسم ١ بيمسك دي، والسطر ده حزام أمان.
    RAISE EXCEPTION 'طلب السحب لازم يكون لمدرب أو ناشر';
  END IF;

  IF v_open > 0 THEN
    RAISE EXCEPTION 'فيه طلب سحب مستني المراجعة خلاص';
  END IF;

  IF v_available <= 0 THEN
    RAISE EXCEPTION 'مفيش رصيد قابل للسحب';
  END IF;

  -- ⚠️ **المبلغ بيتكتب، مش بيتفحص.** اللي جه من العميل بيتجاهل
  --    تمامًا — مفيش فرق بين طلب بمليون وطلب بالرقم الصح: الاتنين
  --    بيتسجّلوا بالرصيد الحقيقي.
  NEW.amount := v_available;

  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guardian_of_student(p_student text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM child_profiles c
    WHERE c.user_profile_id = auth.uid()
      AND NULLIF(btrim(coalesce(c.account_profile_id, '')), '') = p_student
  );
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, role)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'مستخدم جديد'), 'customer')
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.instructor_sessions()
 RETURNS TABLE(session_id text, session_number integer, scheduled_at timestamp with time zone, status text, meeting_url text, subscription_id text, participant_name text, package_name text, package_id text, user_ref text, child_ref text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id::text,
    s.session_number::integer,
    s.scheduled_at,
    s.status::text,
    s.meeting_url,
    cs.id::text,
    -- الطفل أولًا: وجوده معناه إن الحجز ليه هو مش لصاحب الحساب.
    -- الكود كان بيبص على صاحب الحساب الأول، فحجز لابن كان بيرجع اسم
    -- ولي الأمر.
    COALESCE(ch.full_name, up.full_name, 'مشارك غير معروف'),
    COALESCE(p.name, 'باقة محذوفة'),
    cs.package_id::text,
    cs.user_id::text,
    ch.id::text
  FROM sessions s
  JOIN instructors i
    ON i.id = s.instructor_id
   AND i.user_id = auth.uid()
  JOIN course_subscriptions cs       ON cs.id = s.course_subscription_id
  LEFT JOIN child_profiles ch        ON ch.id = cs.child_id
  LEFT JOIN user_profiles up         ON up.id = cs.user_id
  LEFT JOIN creative_writing_packages p ON p.id = cs.package_id
  ORDER BY s.scheduled_at;
$function$
;

CREATE OR REPLACE FUNCTION public.instructor_students()
 RETURNS TABLE(subscription_id text, user_ref text, child_ref text, documents_ref text, participant_name text, package_name text, sessions_total integer, sessions_completed integer, subscription_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    cs.id::text,
    cs.user_id::text,
    ch.id::text,
    COALESCE(
      NULLIF(btrim(coalesce(ch.account_profile_id, '')), ''),
      cs.user_id::text
    ),
    COALESCE(ch.full_name, up.full_name, 'مشارك غير معروف'),
    COALESCE(p.name, 'باقة محذوفة'),
    -- عدد جلسات الباقة هو المرجع. لو لسه ما اتولّدتش، التقدم بيبقى
    -- «0 / 12» بدل ما الطالب يختفي من القايمة.
    COALESCE(p.sessions_count, count(s.id))::integer,
    count(s.id) FILTER (WHERE s.status = 'completed')::integer,
    cs.status::text
  FROM course_subscriptions cs
  JOIN instructors i
    ON i.user_id = auth.uid()
   AND (
        i.id = cs.preferred_instructor_id
        OR EXISTS (
          SELECT 1 FROM sessions s2
          WHERE s2.course_subscription_id = cs.id
            AND s2.instructor_id = i.id
        )
       )
  LEFT JOIN sessions s
    ON s.course_subscription_id = cs.id
   AND s.instructor_id = i.id
  LEFT JOIN child_profiles ch           ON ch.id = cs.child_id
  LEFT JOIN user_profiles up            ON up.id = cs.user_id
  LEFT JOIN creative_writing_packages p ON p.id = cs.package_id
  GROUP BY cs.id, cs.user_id, cs.status, ch.id, ch.full_name,
           ch.account_profile_id, up.full_name, p.name, p.sessions_count;
$function$
;

CREATE OR REPLACE FUNCTION public.instructor_teaches(p_student text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM sessions s
    JOIN instructors i           ON i.id  = s.instructor_id
    JOIN course_subscriptions cs ON cs.id = s.course_subscription_id
    LEFT JOIN child_profiles c   ON c.id  = cs.child_id
    WHERE i.user_id = auth.uid()
      AND (
        cs.user_id::text           = p_student
        OR c.user_profile_id::text = p_student
        -- الجديد: حساب دخول الطفل — وهو صاحب مستندات المعرض.
        OR NULLIF(btrim(coalesce(c.account_profile_id, '')), '') = p_student
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'general_supervisor')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_instructor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'instructor'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.my_dependent_link()
 RETURNS TABLE(child_profile_id text, guardian_profile_id uuid, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id::text,
    c.user_profile_id,
    c.full_name
  FROM child_profiles c
  WHERE c.account_profile_id = (auth.uid())::text
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_admins(p_title text, p_message text DEFAULT NULL::text, p_link text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;

  IF length(trim(coalesce(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'notification needs a title';
  END IF;

  INSERT INTO notifications (recipient_profile_id, title, message, link)
  SELECT
    u.id::text,
    trim(p_title),
    NULLIF(trim(coalesce(p_message, '')), ''),
    p_link
  FROM user_profiles u
  WHERE u.role IN ('super_admin', 'general_supervisor');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$function$
;

CREATE OR REPLACE FUNCTION public.notify_broadcast(p_title text, p_message text DEFAULT NULL::text, p_link text DEFAULT NULL::text, p_role text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  -- الإدارة بس. الدالة دي بتوصل لكل حساب في المنصة، فالبوابة ضيقة عن قصد.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admins only';
  END IF;

  IF length(trim(coalesce(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'notification needs a title';
  END IF;

  INSERT INTO notifications (recipient_profile_id, title, message, link)
  SELECT
    u.id::text,
    trim(p_title),
    NULLIF(trim(coalesce(p_message, '')), ''),
    p_link
  FROM user_profiles u
  WHERE p_role IS NULL OR u.role::text = p_role;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$function$
;

CREATE OR REPLACE FUNCTION public.notify_user(p_recipient text, p_title text, p_message text DEFAULT NULL::text, p_link text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_recipient IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'notification needs a recipient and a title';
  END IF;

  -- المسموح لهم بإرسال إشعار: الإدارة، أو طرف في طلب خدمة يجمعه
  -- بالمستلِم. و«طرف» = المشتري، أو مقدّم الخدمة أيًّا كان نوعه.
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM service_orders o
      LEFT JOIN instructors        i   ON i.id   = o.instructor_id
      LEFT JOIN service_providers  sp  ON sp.id  = o.provider_id
      LEFT JOIN instructors        spi ON spi.id = sp.instructor_id
      WHERE (
              o.buyer_profile_id = auth.uid()::text
              OR i.user_id   = auth.uid()
              OR sp.user_id  = auth.uid()
              OR spi.user_id = auth.uid()
            )
        AND (
              o.buyer_profile_id   = p_recipient
              OR i.user_id::text   = p_recipient
              OR sp.user_id::text  = p_recipient
              OR spi.user_id::text = p_recipient
            )
    )
  ) THEN
    RAISE EXCEPTION 'not allowed to notify this user';
  END IF;

  INSERT INTO notifications (recipient_profile_id, title, message, link)
  VALUES (p_recipient, trim(p_title), NULLIF(trim(coalesce(p_message, '')), ''), p_link);
END
$function$
;

CREATE OR REPLACE FUNCTION public.owns_instructor(p_instructor_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM instructors i
    WHERE i.id = p_instructor_id AND i.user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.public_instructor(p_id text)
 RETURNS TABLE(id text, user_id text, display_name text, bio text, specialties text[], years_experience integer, is_sample boolean, status text, weekly_schedule jsonb, avatar_url text, package_ids text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    i.id::text,
    i.user_id::text,
    i.display_name::text,
    i.bio::text,
    i.specialties::text[],
    i.years_experience::integer,
    i.is_sample,
    i.status::text,
    i.weekly_schedule::jsonb,
    up.avatar_url::text,
    COALESCE(
      (SELECT array_agg(ip.package_id::text)
         FROM public.instructor_packages ip
        WHERE ip.instructor_id::text = i.id::text),
      ARRAY[]::text[]
    )
  FROM public.instructors i
  LEFT JOIN public.user_profiles up
    ON up.id::text = i.user_id::text
  WHERE i.id::text = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.public_instructors()
 RETURNS TABLE(id text, user_id text, display_name text, bio text, specialties text[], years_experience integer, is_sample boolean, status text, weekly_schedule jsonb, avatar_url text, package_ids text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    i.id::text,
    i.user_id::text,
    i.display_name::text,
    i.bio::text,
    i.specialties::text[],
    i.years_experience::integer,
    i.is_sample,
    i.status::text,
    i.weekly_schedule::jsonb,
    up.avatar_url::text,
    -- مصفوفة فاضية معناها «كل الباقات» — الواجهة بتفهمها كده.
    COALESCE(
      (SELECT array_agg(ip.package_id::text)
         FROM public.instructor_packages ip
        WHERE ip.instructor_id::text = i.id::text),
      ARRAY[]::text[]
    )
  FROM public.instructors i
  LEFT JOIN public.user_profiles up
    ON up.id::text = i.user_id::text
  ORDER BY i.created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.record_order_publisher_earnings(p_order_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user      uuid := auth.uid();
  v_order     record;
  v_row       record;
  v_inserted  integer := 0;
  v_recorded  integer := 0;
  v_total     integer := 0;
  v_missing   integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول';
  END IF;

  -- الإدارة وحدها: هي اللي بتعلّم الطلب «مسلَّم» أصلًا.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'الإجراء ده للإدارة';
  END IF;

  SELECT o.id, o.status INTO v_order
    FROM orders o
   WHERE o.id::text = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب مش موجود';
  END IF;

  -- ⚠️ الدالة **مبتغيّرش حالة الطلب** — الإقفال شغل الكود اللي
  --    بيناديها، وخلط الاتنين بيخلّي إعادة النداء خطرة.
  IF v_order.status <> 'delivered' THEN
    RETURN jsonb_build_object(
      'recorded', false, 'reason', 'not_delivered', 'status', v_order.status
    );
  END IF;

  -- ── البند اللي اتباع من غير نصيب مسجَّل ─────────────────
  --
  -- بيتملى من المنتج **بشرط إنه معتمد دلوقتي** — يعني رقم وافقت
  -- عليه الإدارة. رقم ناشر مستني أو مرفوض **مابيتاخدش**: ده بالظبط
  -- الطريق اللي الملف ده بيقفله.
  --
  -- ⚠️ والتعديل ده بيعدّي من الحارس لأن النادي إداري (`is_admin()`
  --    اتفحص فوق).
  UPDATE order_items oi
     SET publisher_cost_snapshot = pp.publisher_cost
    FROM personalized_products pp
   WHERE oi.order_id::text = p_order_id
     AND oi.publisher_id_snapshot IS NOT NULL
     AND oi.publisher_cost_snapshot IS NULL
     AND pp.id::text = oi.product_id::text
     AND pp.publisher_id::text = oi.publisher_id_snapshot
     AND pp.review_status = 'approved'
     AND pp.publisher_cost IS NOT NULL
     AND pp.publisher_cost > 0;

  -- صفّ لكل ناشر في الطلب. **المبلغ من البند المثبّت لا من المنتج.**
  --
  -- ⚠️ `LEFT JOIN` على المنتج: الاسم بس هو اللي جاي منه (لوصف
  --    المستحق). لو المنتج اتشال يومًا، المستحق مايضيعش.
  FOR v_row IN
    SELECT oi.publisher_id_snapshot                                        AS publisher_id,
           sum(oi.publisher_cost_snapshot * oi.quantity)::integer          AS amount,
           count(*)                                                        AS lines,
           count(*) FILTER (WHERE oi.publisher_cost_snapshot IS NULL)      AS no_cost,
           string_agg(DISTINCT pp.name, '، ')                              AS titles
      FROM order_items oi
      LEFT JOIN personalized_products pp ON pp.id::text = oi.product_id::text
     WHERE oi.order_id::text = p_order_id
       AND oi.publisher_id_snapshot IS NOT NULL
     GROUP BY oi.publisher_id_snapshot
  LOOP
    -- منتج بلا نصيب مسجَّل: **مش بنسجّل صفرًا**. الصفر بيبان مستحقًّا
    -- تمّ حسابه، والحقيقة إن الرقم ناقص.
    IF v_row.no_cost > 0 OR v_row.amount IS NULL OR v_row.amount <= 0 THEN
      v_missing := v_missing + 1;
      CONTINUE;
    END IF;

    INSERT INTO publisher_payouts (
      publisher_id, period, amount, status, source_type, source_id, description
    )
    VALUES (
      v_row.publisher_id,
      to_char(now(), 'YYYY-MM'),
      v_row.amount,
      'pending',
      'order',
      v_order.id::text,
      COALESCE(v_row.titles, 'منتجات')
    )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted > 0 THEN
      v_recorded := v_recorded + 1;
      v_total := v_total + v_row.amount;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'recorded',  v_recorded > 0,
    'publishers', v_recorded,
    'amount',    v_total,
    'missing_cost', v_missing,
    'reason',    CASE
                   WHEN v_recorded > 0 THEN 'inserted'
                   WHEN v_missing > 0  THEN 'missing_cost'
                   ELSE 'nothing_to_record'
                 END
  );
END
$function$
;

CREATE OR REPLACE FUNCTION public.record_service_order_earning(p_order_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user     uuid := auth.uid();
  v_order    record;
  v_earning  numeric;
  v_name     text;
  v_inserted integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول';
  END IF;

  SELECT o.id, o.buyer_profile_id, o.instructor_id, o.instructor_earning,
         o.amount, o.status, o.standalone_service_id
    INTO v_order
    FROM service_orders o
   WHERE o.id::text = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب مش موجود';
  END IF;

  -- المشتري أو الإدارة وبس. مفيش طرف تالت بيسجّل مستحقات.
  IF v_order.buyer_profile_id::text <> v_user::text
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'الطلب ده مش طلبك';
  END IF;

  -- ⚠️ المستحق بيتسجّل **بعد** الاكتمال وبس. الدالة مبتقفلش الطلب
  --    ومبتغيّرش حالته — ده شغل الكود اللي بيناديها.
  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'الطلب لسه ما اكتملش';
  END IF;

  IF v_order.instructor_id IS NULL THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'no_instructor');
  END IF;

  -- المبلغ من صف الطلب لا من المتصفح.
  v_earning := COALESCE(v_order.instructor_earning, v_order.amount);
  IF v_earning IS NULL OR v_earning <= 0 THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'no_amount');
  END IF;

  SELECT s.name INTO v_name
    FROM standalone_services s
   WHERE s.id = v_order.standalone_service_id;

  INSERT INTO instructor_payouts (
    instructor_id, period, amount, status, source_type, source_id, description
  )
  VALUES (
    v_order.instructor_id,
    to_char(now(), 'YYYY-MM'),
    round(v_earning)::integer,
    'pending',
    'service_order',
    v_order.id::text,
    COALESCE(v_name, 'خدمة إبداعية')
  )
  -- الفهرس الفريد `instructor_payouts_service_order_unique` هو اللي
  -- بيمسك التكرار. `DO NOTHING` بيخلّي إعادة النداء آمنة.
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'recorded', v_inserted > 0,
    'reason', CASE WHEN v_inserted > 0 THEN 'inserted' ELSE 'already_recorded' END,
    'amount', round(v_earning)::integer
  );
END
$function$
;

CREATE OR REPLACE FUNCTION public.reset_due_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    NEW.due_warned_at           := NULL;
    NEW.due_overdue_notified_at := NULL;
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.set_instructor_packages(p_instructor_id text, p_package_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valid text[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'الإجراء ده للإدارة';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM instructors WHERE id::text = p_instructor_id) THEN
    RAISE EXCEPTION 'المدرب مش موجود';
  END IF;

  -- الباقات الموجودة فعلًا وبس. رقم باقة اتمسحت بيتجاهل بدل ما
  -- يوقّع العملية كلها.
  SELECT COALESCE(array_agg(p.id::text), ARRAY[]::text[]) INTO v_valid
    FROM creative_writing_packages p
   WHERE p.id::text = ANY(COALESCE(p_package_ids, ARRAY[]::text[]));

  DELETE FROM instructor_packages WHERE instructor_id::text = p_instructor_id;

  IF array_length(v_valid, 1) > 0 THEN
    INSERT INTO instructor_packages (instructor_id, package_id)
    SELECT p_instructor_id, unnest(v_valid);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'count', COALESCE(array_length(v_valid, 1), 0),
    'all_packages', COALESCE(array_length(v_valid, 1), 0) = 0
  );
END
$function$
;

CREATE OR REPLACE FUNCTION public.snapshot_publisher_share()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_publisher text;
  v_cost      integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- ⚠️ **دايمًا من صف المنتج، حتى لو الإدراج جاي بقيمة.** اللي
    --    بيدرج البند (دالة الطلب أو الإدارة) مايقرّرش نصيب الناشر.
    --
    -- ⚠️ وبصلاحية صاحب الدالة: لو قرا بصلاحية المشتري وسياسة القراءة
    --    اتضيّقت يومًا، الصفّ هيرجع **فاضي لا خطأ** (قاعدة «ك»)
    --    والنصيب يتسجّل فاضي في صمت.
    SELECT p.publisher_id::text, p.publisher_cost
      INTO v_publisher, v_cost
      FROM public.personalized_products p
     WHERE p.id::text = NEW.product_id::text
       AND p.publisher_id IS NOT NULL;

    -- منتج المنصة (أو إضافة مش في جدول المنتجات): مفيش صفّ، فالمتغيّران
    -- فاضيين — والقيمة الجاية مع الإدراج **بتتمسح** بيهم.
    NEW.publisher_id_snapshot := v_publisher;

    -- صفر أو سالب = مفيش نصيب مسجَّل، مش «نصيب صفر».
    NEW.publisher_cost_snapshot := CASE WHEN v_cost > 0 THEN v_cost ELSE NULL END;

    RETURN NEW;
  END IF;

  -- ══ تعديل ══
  -- فاضية = مفتاح الخدمة · والإدارة بتقدر تصحّح رقمًا اتسجّل غلط.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.publisher_id_snapshot   := OLD.publisher_id_snapshot;
  NEW.publisher_cost_snapshot := OLD.publisher_cost_snapshot;
  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.student_sessions()
 RETURNS TABLE(session_id text, session_number integer, scheduled_at timestamp with time zone, status text, meeting_url text, package_name text, instructor_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id::text,
    s.session_number::integer,
    s.scheduled_at,
    s.status::text,
    s.meeting_url,
    COALESCE(p.name, 'باقة محذوفة'),
    i.display_name
  FROM sessions s
  JOIN course_subscriptions cs ON cs.id = s.course_subscription_id
  LEFT JOIN child_profiles ch  ON ch.id = cs.child_id
  LEFT JOIN instructors i      ON i.id = s.instructor_id
  LEFT JOIN creative_writing_packages p ON p.id = cs.package_id
  WHERE
    -- حاجز لنفسه
    cs.user_id = auth.uid()
    -- أو الحجز لطفل، والداخل دلوقتي هو حساب الطفل ده
    OR ch.account_profile_id = (auth.uid())::text
  ORDER BY s.scheduled_at;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_guardian_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE user_profiles
    SET is_guardian = true
    WHERE id = NEW.user_profile_id;
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    -- runs after the row is gone, so this reflects what is left
    UPDATE user_profiles
    SET is_guardian = EXISTS (
      SELECT 1 FROM child_profiles
      WHERE user_profile_id = OLD.user_profile_id
    )
    WHERE id = OLD.user_profile_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_user_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_emails (user_id, email, updated_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email, updated_at = NOW();

  RETURN NEW;
END
$function$
;

SET check_function_bodies = on;

-- ════════════════════════════════════════════════════════════
-- ٣. الروابط بين الجداول (45)
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.account_deletion_requests ADD CONSTRAINT account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.box_shipments ADD CONSTRAINT box_shipments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES box_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE public.box_subscriptions ADD CONSTRAINT box_subscriptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
ALTER TABLE public.box_subscriptions ADD CONSTRAINT box_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.child_profiles ADD CONSTRAINT child_profiles_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.course_subscriptions ADD CONSTRAINT course_subscriptions_child_id_fkey FOREIGN KEY (child_id) REFERENCES child_profiles(id);
ALTER TABLE public.course_subscriptions ADD CONSTRAINT course_subscriptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES creative_writing_packages(id);
ALTER TABLE public.course_subscriptions ADD CONSTRAINT course_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id);
ALTER TABLE public.creative_writing_packages ADD CONSTRAINT creative_writing_packages_prerequisite_package_id_fkey FOREIGN KEY (prerequisite_package_id) REFERENCES creative_writing_packages(id);
ALTER TABLE public.dependent_requests ADD CONSTRAINT dependent_requests_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dependent_requests ADD CONSTRAINT dependent_requests_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL;
ALTER TABLE public.dependent_requests ADD CONSTRAINT dependent_requests_package_id_fkey FOREIGN KEY (package_id) REFERENCES creative_writing_packages(id) ON DELETE SET NULL;
ALTER TABLE public.dependent_requests ADD CONSTRAINT dependent_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE SET NULL;
ALTER TABLE public.dependent_requests ADD CONSTRAINT dependent_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES standalone_services(id) ON DELETE SET NULL;
ALTER TABLE public.instructor_media ADD CONSTRAINT instructor_media_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE;
ALTER TABLE public.instructor_packages ADD CONSTRAINT instructor_packages_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE;
ALTER TABLE public.instructor_packages ADD CONSTRAINT instructor_packages_package_id_fkey FOREIGN KEY (package_id) REFERENCES creative_writing_packages(id) ON DELETE CASCADE;
ALTER TABLE public.instructor_payouts ADD CONSTRAINT instructor_payouts_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE;
ALTER TABLE public.instructor_pricing ADD CONSTRAINT instructor_pricing_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE;
ALTER TABLE public.instructors ADD CONSTRAINT instructors_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_documents ADD CONSTRAINT portfolio_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.provider_services ADD CONSTRAINT provider_services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE;
ALTER TABLE public.provider_services ADD CONSTRAINT provider_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES standalone_services(id) ON DELETE CASCADE;
ALTER TABLE public.publisher_payouts ADD CONSTRAINT publisher_payouts_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE;
ALTER TABLE public.publishers ADD CONSTRAINT publishers_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_dependent_participant_id_fkey FOREIGN KEY (dependent_participant_id) REFERENCES child_profiles(id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE;
ALTER TABLE public.service_order_messages ADD CONSTRAINT service_order_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES service_orders(id) ON DELETE CASCADE;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_package_id_fkey FOREIGN KEY (package_id) REFERENCES creative_writing_packages(id);
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE SET NULL;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_standalone_service_id_fkey FOREIGN KEY (standalone_service_id) REFERENCES standalone_services(id);
ALTER TABLE public.service_providers ADD CONSTRAINT service_providers_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE;
ALTER TABLE public.service_providers ADD CONSTRAINT service_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.session_reports ADD CONSTRAINT session_reports_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE;
ALTER TABLE public.session_reports ADD CONSTRAINT session_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_course_subscription_id_fkey FOREIGN KEY (course_subscription_id) REFERENCES course_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL;
ALTER TABLE public.study_materials ADD CONSTRAINT study_materials_package_id_fkey FOREIGN KEY (package_id) REFERENCES creative_writing_packages(id);
ALTER TABLE public.support_session_requests ADD CONSTRAINT support_session_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_emails ADD CONSTRAINT user_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE;
ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════════
-- ٤. الفهارس (29)
-- ════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX account_deletion_one_open_per_user ON public.account_deletion_requests USING btree (user_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX box_plans_one_highlight ON public.box_subscription_plans USING btree (is_highlighted) WHERE (is_highlighted = true);
CREATE INDEX box_plans_order_idx ON public.box_subscription_plans USING btree (is_active, sort_order);
CREATE UNIQUE INDEX child_profiles_account_unique ON public.child_profiles USING btree (account_profile_id) WHERE (account_profile_id IS NOT NULL);
CREATE UNIQUE INDEX course_subscriptions_payment_reference_key ON public.course_subscriptions USING btree (payment_reference);
CREATE INDEX dependent_requests_child_idx ON public.dependent_requests USING btree (child_profile_id, status);
CREATE INDEX dependent_requests_guardian_idx ON public.dependent_requests USING btree (guardian_profile_id, status);
CREATE INDEX instructor_media_lookup ON public.instructor_media USING btree (instructor_id, kind, status, sort_order);
CREATE UNIQUE INDEX instructor_media_one_cover ON public.instructor_media USING btree (instructor_id) WHERE ((kind = 'cover'::text) AND (status = 'approved'::text));
CREATE UNIQUE INDEX instructor_payouts_service_order_unique ON public.instructor_payouts USING btree (source_id) WHERE (source_type = 'service_order'::text);
CREATE INDEX notifications_recipient_idx ON public.notifications USING btree (recipient_profile_id, is_read, created_at DESC);
CREATE UNIQUE INDEX orders_payment_reference_key ON public.orders USING btree (payment_reference);
CREATE INDEX personalized_products_previous_slugs_idx ON public.personalized_products USING gin (previous_slugs);
CREATE UNIQUE INDEX publisher_payouts_source_unique ON public.publisher_payouts USING btree (source_type, source_id, publisher_id) WHERE ((source_type IS NOT NULL) AND (source_id IS NOT NULL));
CREATE INDEX reviews_instructor_visible_idx ON public.reviews USING btree (instructor_id) WHERE (is_hidden = false);
CREATE UNIQUE INDEX reviews_service_order_unique ON public.reviews USING btree (service_order_id) WHERE (service_order_id IS NOT NULL);
CREATE INDEX service_order_messages_order_idx ON public.service_order_messages USING btree (order_id, created_at);
CREATE INDEX service_orders_due_idx ON public.service_orders USING btree (due_at) WHERE (due_at IS NOT NULL);
CREATE UNIQUE INDEX service_orders_payment_reference_key ON public.service_orders USING btree (payment_reference);
CREATE INDEX service_orders_provider_idx ON public.service_orders USING btree (provider_id);
CREATE INDEX service_orders_status_delivered_idx ON public.service_orders USING btree (status, delivered_at);
CREATE UNIQUE INDEX service_providers_instructor_unique ON public.service_providers USING btree (instructor_id) WHERE (instructor_id IS NOT NULL);
CREATE UNIQUE INDEX service_providers_one_platform ON public.service_providers USING btree (kind) WHERE (kind = 'platform'::provider_kind);
CREATE UNIQUE INDEX service_providers_user_unique ON public.service_providers USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX sessions_room_name_idx ON public.sessions USING btree (room_name) WHERE (room_name IS NOT NULL);
CREATE INDEX shipping_rates_active_idx ON public.shipping_rates USING btree (is_active, governorate, city);
CREATE UNIQUE INDEX site_settings_key_unique ON public.site_settings USING btree (key);
CREATE INDEX user_emails_email_idx ON public.user_emails USING btree (lower(email));
CREATE INDEX withdrawal_requests_instructor_idx ON public.withdrawal_requests USING btree (instructor_id, created_at DESC);

-- ════════════════════════════════════════════════════════════
-- ٥. المحفّزات (24 + ٢ على حسابات الدخول)
-- ════════════════════════════════════════════════════════════

CREATE TRIGGER trg_sync_guardian_flag_del AFTER DELETE ON child_profiles FOR EACH ROW EXECUTE FUNCTION sync_guardian_flag();
CREATE TRIGGER trg_sync_guardian_flag_ins AFTER INSERT ON child_profiles FOR EACH ROW EXECUTE FUNCTION sync_guardian_flag();
CREATE TRIGGER block_suspended_purchase_trg BEFORE INSERT ON course_subscriptions FOR EACH ROW EXECUTE FUNCTION block_suspended_purchase('user_id');
CREATE TRIGGER guard_course_subscription_fields_trg BEFORE UPDATE ON course_subscriptions FOR EACH ROW EXECUTE FUNCTION guard_course_subscription_fields();
CREATE TRIGGER guard_instructor_media_update BEFORE UPDATE ON instructor_media FOR EACH ROW EXECUTE FUNCTION guard_instructor_media();
CREATE TRIGGER guard_instructor_fields_trg BEFORE UPDATE ON instructors FOR EACH ROW EXECUTE FUNCTION guard_instructor_fields();
CREATE TRIGGER block_inactive_product_trg BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION block_inactive_product();
CREATE TRIGGER snapshot_publisher_share_trg BEFORE INSERT OR UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION snapshot_publisher_share();
CREATE TRIGGER activate_box_subscription_trg AFTER UPDATE OF status ON orders FOR EACH ROW WHEN (new.status = 'paid'::order_status_enum AND old.status IS DISTINCT FROM 'paid'::order_status_enum AND new.box_plan_id IS NOT NULL) EXECUTE FUNCTION activate_box_subscription();
CREATE TRIGGER block_suspended_purchase_trg BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION block_suspended_purchase('user_id');
CREATE TRIGGER guard_order_fields_trg BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION guard_order_fields();
CREATE TRIGGER guard_order_insert_trg BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION guard_order_insert();
CREATE TRIGGER guard_product_review_biu BEFORE INSERT OR UPDATE ON personalized_products FOR EACH ROW EXECUTE FUNCTION guard_product_review();
CREATE TRIGGER guard_portfolio_document_fields_trg BEFORE UPDATE ON portfolio_documents FOR EACH ROW EXECUTE FUNCTION guard_portfolio_document_fields();
CREATE TRIGGER guard_provider_service_fields_trg BEFORE INSERT OR UPDATE ON provider_services FOR EACH ROW EXECUTE FUNCTION guard_provider_service_fields();
CREATE TRIGGER guard_publisher_fields_trg BEFORE UPDATE ON publishers FOR EACH ROW EXECUTE FUNCTION guard_publisher_fields();
CREATE TRIGGER block_suspended_purchase_trg BEFORE INSERT ON service_orders FOR EACH ROW EXECUTE FUNCTION block_suspended_purchase('buyer_profile_id');
CREATE TRIGGER guard_service_order_fields_trg BEFORE INSERT OR UPDATE ON service_orders FOR EACH ROW EXECUTE FUNCTION guard_service_order_fields();
CREATE TRIGGER reset_due_notifications_trg BEFORE UPDATE OF due_at ON service_orders FOR EACH ROW EXECUTE FUNCTION reset_due_notifications();
CREATE TRIGGER guard_provider_fields_trg BEFORE UPDATE ON service_providers FOR EACH ROW EXECUTE FUNCTION guard_provider_fields();
CREATE TRIGGER guard_session_fields_trg BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION guard_session_fields();
CREATE TRIGGER guard_suspension_target_trg BEFORE INSERT OR UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION guard_suspension_target();
CREATE TRIGGER guard_user_profile_fields_trg BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION guard_user_profile_fields();
CREATE TRIGGER guard_withdrawal_request_trg BEFORE INSERT ON withdrawal_requests FOR EACH ROW EXECUTE FUNCTION guard_withdrawal_request();

-- حسابات الدخول (auth.users): كل حساب جديد ليه صفّ في user_profiles،
-- وإيميله بيتنسخ في user_emails. الاتنين كانوا معمولين من برّه الملفات.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_email_sync
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_email();

-- ════════════════════════════════════════════════════════════
-- ٦. سياسات الصلاحيات (143)
-- ════════════════════════════════════════════════════════════

CREATE POLICY "Admins manage deletion requests" ON public.account_deletion_requests AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Users file their own deletion request" ON public.account_deletion_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = auth.uid()) AND (status = 'pending'::text)));
CREATE POLICY "Users read their own deletion requests" ON public.account_deletion_requests AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR is_admin()));
CREATE POLICY "Active addons are public" ON public.addon_products AS PERMISSIVE FOR SELECT TO public
  USING (((is_active = true) OR is_admin()));
CREATE POLICY "Admins manage addons" ON public.addon_products AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Super admin can view audit logs" ON public.audit_logs AS PERMISSIVE FOR SELECT TO public
  USING (is_super_admin());
CREATE POLICY "Users write audit logs as themselves" ON public.audit_logs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_admin() OR (actor_profile_id = (auth.uid())::text)));
CREATE POLICY "Admins can manage blog posts" ON public.blog_posts AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Blog posts are viewable by everyone" ON public.blog_posts AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Admins manage box shipments" ON public.box_shipments AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Subscribers view their shipments" ON public.box_shipments AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM box_subscriptions s
  WHERE ((s.id = box_shipments.subscription_id) AND (s.user_id = auth.uid())))));
CREATE POLICY "Admins manage box plans" ON public.box_subscription_plans AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Box plans are public" ON public.box_subscription_plans AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));
CREATE POLICY "Admins can manage all subscriptions" ON public.box_subscriptions AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Users can view their own subscriptions" ON public.box_subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Guardians manage their own children" ON public.child_profiles AS PERMISSIVE FOR ALL TO public
  USING (((auth.uid() = user_profile_id) OR is_admin()))
  WITH CHECK (((auth.uid() = user_profile_id) OR is_admin()));
CREATE POLICY "Admins manage subscriptions" ON public.course_subscriptions AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Users read their own subscriptions" ON public.course_subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Users update their own subscriptions" ON public.course_subscriptions AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Admins can manage packages" ON public.creative_writing_packages AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Packages are viewable by everyone" ON public.creative_writing_packages AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Family can create dependent requests" ON public.dependent_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (can_see_dependent_request(child_profile_id));
CREATE POLICY "Family can read dependent requests" ON public.dependent_requests AS PERMISSIVE FOR SELECT TO public
  USING (can_see_dependent_request(child_profile_id));
CREATE POLICY "Guardians decide dependent requests" ON public.dependent_requests AS PERMISSIVE FOR UPDATE TO public
  USING (((guardian_profile_id = auth.uid()) OR is_admin()))
  WITH CHECK (((guardian_profile_id = auth.uid()) OR is_admin()));
CREATE POLICY "Instructor views own certification, admin manages all" ON public.instructor_certifications AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM instructors
  WHERE ((instructors.id = instructor_certifications.instructor_id) AND (instructors.user_id = auth.uid())))) OR is_admin()))
  WITH CHECK (is_admin());
CREATE POLICY "Admins manage media" ON public.instructor_media AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Anyone reads approved media" ON public.instructor_media AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((status = 'approved'::text));
CREATE POLICY "Instructor adds own media" ON public.instructor_media AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = instructor_media.instructor_id) AND (i.user_id = auth.uid()))))));
CREATE POLICY "Instructor edits own media" ON public.instructor_media AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = instructor_media.instructor_id) AND (i.user_id = auth.uid())))));
CREATE POLICY "Instructor reads own media" ON public.instructor_media AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = instructor_media.instructor_id) AND (i.user_id = auth.uid())))));
CREATE POLICY "Instructor removes own media" ON public.instructor_media AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = instructor_media.instructor_id) AND (i.user_id = auth.uid())))));
CREATE POLICY "Admins manage instructor packages" ON public.instructor_packages AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Anyone can read instructor packages" ON public.instructor_packages AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Instructors can view their own payouts" ON public.instructor_payouts AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM instructors
  WHERE ((instructors.id = instructor_payouts.instructor_id) AND (instructors.user_id = auth.uid())))));
CREATE POLICY "Super admin can manage instructor payouts" ON public.instructor_payouts AS PERMISSIVE FOR ALL TO public
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
CREATE POLICY "Admins and the instructor read pricing" ON public.instructor_pricing AS PERMISSIVE FOR SELECT TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = instructor_pricing.instructor_id) AND (i.user_id = auth.uid()))))));
CREATE POLICY "Admins write pricing" ON public.instructor_pricing AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Admins can manage pricing options" ON public.instructor_pricing_options AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Pricing options are viewable by everyone" ON public.instructor_pricing_options AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Admins can manage instructors" ON public.instructors AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Instructors can update their own profile" ON public.instructors AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Signed-in users read instructors" ON public.instructors AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can view/update join requests" ON public.join_requests AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Anyone can apply to join" ON public.join_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((status = 'pending'::join_request_status_enum));
CREATE POLICY "Admins can read all notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());
CREATE POLICY "Admins manage notifications" ON public.notifications AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Users mark their own notifications read" ON public.notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((recipient_profile_id = (auth.uid())::text))
  WITH CHECK ((recipient_profile_id = (auth.uid())::text));
CREATE POLICY "Users read their own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO public
  USING ((recipient_profile_id = (auth.uid())::text));
CREATE POLICY "Admins can manage all order items" ON public.order_items AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Users can view their own order items" ON public.order_items AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));
CREATE POLICY "Admins can manage all orders" ON public.orders AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Users can update their own orders" ON public.orders AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own orders" ON public.orders AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Admins manage page content" ON public.page_content AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Page content is public" ON public.page_content AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Admins can manage products" ON public.personalized_products AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Anyone reads approved active products" ON public.personalized_products AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((review_status = 'approved'::text) AND is_active));
CREATE POLICY "Publisher adds own products" ON public.personalized_products AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((review_status = 'pending'::text) AND (owner_type = 'publisher'::owner_type) AND (EXISTS ( SELECT 1
   FROM publishers pub
  WHERE ((pub.id = personalized_products.publisher_id) AND (pub.user_id = auth.uid()))))));
CREATE POLICY "Publisher edits own products" ON public.personalized_products AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM publishers pub
  WHERE ((pub.id = personalized_products.publisher_id) AND (pub.user_id = auth.uid())))));
CREATE POLICY "Publisher reads own products" ON public.personalized_products AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM publishers pub
  WHERE ((pub.id = personalized_products.publisher_id) AND (pub.user_id = auth.uid())))));
CREATE POLICY "Admins manage portfolio documents" ON public.portfolio_documents AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Guardians read their dependents documents" ON public.portfolio_documents AS PERMISSIVE FOR SELECT TO authenticated
  USING (guardian_of_student((student_id)::text));
CREATE POLICY "Instructors grade their own students documents" ON public.portfolio_documents AS PERMISSIVE FOR UPDATE TO public
  USING (instructor_teaches((student_id)::text))
  WITH CHECK (instructor_teaches((student_id)::text));
CREATE POLICY "Instructors read their own students documents" ON public.portfolio_documents AS PERMISSIVE FOR SELECT TO public
  USING (instructor_teaches((student_id)::text));
CREATE POLICY "Users can create their own documents" ON public.portfolio_documents AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = student_id));
CREATE POLICY "Users can update their own documents" ON public.portfolio_documents AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = student_id));
CREATE POLICY "Users can view their own documents" ON public.portfolio_documents AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = student_id));
CREATE POLICY "Admins can manage pricing formulas" ON public.pricing_formula_settings AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Instructors can read the pricing formula" ON public.pricing_formula_settings AS PERMISSIVE FOR SELECT TO public
  USING (is_instructor());
CREATE POLICY "Instructor own requests, admin all" ON public.profile_update_requests AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM instructors
  WHERE ((instructors.id = profile_update_requests.instructor_id) AND (instructors.user_id = auth.uid())))) OR is_admin()))
  WITH CHECK (is_admin());
CREATE POLICY "Instructors can file their own update request" ON public.profile_update_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((status = 'pending'::update_request_status) AND (EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = profile_update_requests.instructor_id) AND (i.user_id = auth.uid()))))));
CREATE POLICY "Admins delete offerings" ON public.provider_services AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());
CREATE POLICY "Approved offerings are readable" ON public.provider_services AS PERMISSIVE FOR SELECT TO public
  USING (((status = 'approved'::text) AND (is_active = true)));
CREATE POLICY "Providers propose their own offerings" ON public.provider_services AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM (service_providers sp
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((sp.id = provider_services.provider_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid())))))));
CREATE POLICY "Providers read their own offerings" ON public.provider_services AS PERMISSIVE FOR SELECT TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM (service_providers sp
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((sp.id = provider_services.provider_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid())))))));
CREATE POLICY "Providers update their own offerings" ON public.provider_services AS PERMISSIVE FOR UPDATE TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM (service_providers sp
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((sp.id = provider_services.provider_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid())))))))
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM (service_providers sp
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((sp.id = provider_services.provider_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid())))))));
CREATE POLICY "Providers withdraw their own pending offerings" ON public.provider_services AS PERMISSIVE FOR DELETE TO public
  USING (((status <> 'approved'::text) AND (EXISTS ( SELECT 1
   FROM (service_providers sp
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((sp.id = provider_services.provider_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid())))))));
CREATE POLICY "Publishers can view their own payouts" ON public.publisher_payouts AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM publishers
  WHERE ((publishers.id = publisher_payouts.publisher_id) AND (publishers.user_id = auth.uid())))));
CREATE POLICY "Super admin can manage publisher payouts" ON public.publisher_payouts AS PERMISSIVE FOR ALL TO public
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
CREATE POLICY "Admins can manage publishers" ON public.publishers AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Publishers are viewable by everyone" ON public.publishers AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Publishers can update their own profile" ON public.publishers AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Admins manage reviews" ON public.reviews AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Buyers review their completed orders" ON public.reviews AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((reviewer_profile_id = (auth.uid())::text) AND (service_order_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM service_orders o
  WHERE ((o.id = reviews.service_order_id) AND (o.buyer_profile_id = (auth.uid())::text) AND (o.status = 'completed'::service_order_status) AND (o.instructor_id = reviews.instructor_id))))));
CREATE POLICY "Reviewers see their own reviews" ON public.reviews AS PERMISSIVE FOR SELECT TO public
  USING ((reviewer_profile_id = (auth.uid())::text));
CREATE POLICY "Visible reviews are public" ON public.reviews AS PERMISSIVE FOR SELECT TO public
  USING ((is_hidden = false));
CREATE POLICY "Assigned provider reads order messages" ON public.service_order_messages AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM ((service_orders o
     JOIN service_providers sp ON ((sp.id = o.provider_id)))
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((o.id = service_order_messages.order_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid()))))));
CREATE POLICY "Assigned provider writes order messages" ON public.service_order_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((sender_profile_id = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM ((service_orders o
     JOIN service_providers sp ON ((sp.id = o.provider_id)))
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((o.id = service_order_messages.order_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid())))))));
CREATE POLICY "Order participants read messages" ON public.service_order_messages AS PERMISSIVE FOR SELECT TO public
  USING (can_access_service_order(order_id));
CREATE POLICY "Order participants write messages" ON public.service_order_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((sender_profile_id = (auth.uid())::text) AND can_access_service_order(order_id)));
CREATE POLICY "Assigned instructor can view their service orders" ON public.service_orders AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = service_orders.instructor_id) AND (i.user_id = auth.uid())))));
CREATE POLICY "Assigned instructor updates their service orders" ON public.service_orders AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = service_orders.instructor_id) AND (i.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = service_orders.instructor_id) AND (i.user_id = auth.uid())))));
CREATE POLICY "Assigned provider updates their service orders" ON public.service_orders AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM (service_providers sp
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((sp.id = service_orders.provider_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (service_providers sp
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((sp.id = service_orders.provider_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid()))))));
CREATE POLICY "Assigned provider views their service orders" ON public.service_orders AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (service_providers sp
     LEFT JOIN instructors i ON ((i.id = sp.instructor_id)))
  WHERE ((sp.id = service_orders.provider_id) AND ((sp.user_id = auth.uid()) OR (i.user_id = auth.uid()))))));
CREATE POLICY "Buyer creates own service orders" ON public.service_orders AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((buyer_profile_id = (auth.uid())::text) OR is_admin()));
CREATE POLICY "Buyer reads and writes own service orders" ON public.service_orders AS PERMISSIVE FOR SELECT TO public
  USING (((buyer_profile_id = (auth.uid())::text) OR is_admin()));
CREATE POLICY "Buyer updates own service orders" ON public.service_orders AS PERMISSIVE FOR UPDATE TO public
  USING (((buyer_profile_id = (auth.uid())::text) OR is_admin()))
  WITH CHECK (((buyer_profile_id = (auth.uid())::text) OR is_admin()));
CREATE POLICY "Only admins delete service orders" ON public.service_orders AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());
CREATE POLICY "Active providers are readable" ON public.service_providers AS PERMISSIVE FOR SELECT TO public
  USING ((status = 'active'::provider_status));
CREATE POLICY "Admins delete providers" ON public.service_providers AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());
CREATE POLICY "Admins insert providers" ON public.service_providers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin());
CREATE POLICY "Admins or owner update providers" ON public.service_providers AS PERMISSIVE FOR UPDATE TO public
  USING ((is_admin() OR (user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = service_providers.instructor_id) AND (i.user_id = auth.uid()))))))
  WITH CHECK ((is_admin() OR (user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = service_providers.instructor_id) AND (i.user_id = auth.uid()))))));
CREATE POLICY "Instructors create their own provider row" ON public.service_providers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((kind = 'instructor'::provider_kind) AND (EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = service_providers.instructor_id) AND (i.user_id = auth.uid()) AND ((service_providers.status = 'pending'::provider_status) OR ((service_providers.status = 'active'::provider_status) AND (i.status = 'active'::instructor_status_enum))))))));
CREATE POLICY "Providers read their own row" ON public.service_providers AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = service_providers.instructor_id) AND (i.user_id = auth.uid())))) OR is_admin()));
CREATE POLICY "Admin manages session attachments" ON public.session_attachments AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Admin manages session messages" ON public.session_messages AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Admins manage session reports" ON public.session_reports AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Instructors read their own session reports" ON public.session_reports AS PERMISSIVE FOR SELECT TO public
  USING (owns_instructor(instructor_id));
CREATE POLICY "Instructors update their own session reports" ON public.session_reports AS PERMISSIVE FOR UPDATE TO public
  USING (owns_instructor(instructor_id))
  WITH CHECK (owns_instructor(instructor_id));
CREATE POLICY "Instructors write their own session reports" ON public.session_reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (owns_instructor(instructor_id));
CREATE POLICY "Participants read their session report" ON public.session_reports AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM ((sessions s
     JOIN course_subscriptions cs ON ((cs.id = s.course_subscription_id)))
     LEFT JOIN child_profiles c ON ((c.id = cs.child_id)))
  WHERE ((s.id = session_reports.session_id) AND ((cs.user_id = auth.uid()) OR (c.user_profile_id = auth.uid()))))));
CREATE POLICY "Admin can delete sessions" ON public.sessions AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());
CREATE POLICY "Instructor or admin can update sessions" ON public.sessions AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM instructors
  WHERE ((instructors.id = sessions.instructor_id) AND (instructors.user_id = auth.uid())))) OR is_admin()));
CREATE POLICY "Only admins can create sessions" ON public.sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin());
CREATE POLICY "View own or assigned or admin sessions" ON public.sessions AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM course_subscriptions
  WHERE ((course_subscriptions.id = sessions.course_subscription_id) AND (course_subscriptions.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM instructors
  WHERE ((instructors.id = sessions.instructor_id) AND (instructors.user_id = auth.uid())))) OR is_admin()));
CREATE POLICY "Admins manage shipping rates" ON public.shipping_rates AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Shipping rates are public" ON public.shipping_rates AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));
CREATE POLICY "Admins can manage settings" ON public.site_settings AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Settings are viewable by everyone" ON public.site_settings AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Admins can manage services" ON public.standalone_services AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Services are viewable by everyone" ON public.standalone_services AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Admins can manage study materials" ON public.study_materials AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Study materials are viewable by everyone" ON public.study_materials AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Admins can view/update session requests" ON public.support_session_requests AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Anyone can create support session requests" ON public.support_session_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((((user_id IS NULL) OR (user_id = auth.uid())) AND (status = 'pending'::support_session_status_enum)));
CREATE POLICY "Users can view their own support session requests" ON public.support_session_requests AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Ticket owner or admin can view/reply" ON public.support_ticket_messages AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE (((t.id)::text = support_ticket_messages.ticket_id) AND (t.user_id = auth.uid())))) OR is_admin()))
  WITH CHECK ((is_admin() OR ((sender_profile_id = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE (((t.id)::text = support_ticket_messages.ticket_id) AND (t.user_id = auth.uid())))))));
CREATE POLICY "Admins can view/update all tickets" ON public.support_tickets AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Users can create tickets" ON public.support_tickets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));
CREATE POLICY "Users can view their own tickets" ON public.support_tickets AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Admins can manage testimonials" ON public.testimonials AS PERMISSIVE FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Testimonials are viewable by everyone" ON public.testimonials AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Admins read user emails" ON public.user_emails AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());
CREATE POLICY "Users read their own email" ON public.user_emails AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
CREATE POLICY "Admins can update any profile" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Profiles visible to those who need them" ON public.user_profiles AS PERMISSIVE FOR SELECT TO public
  USING (can_see_profile(id));
CREATE POLICY "Users can update their own profile" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id));
CREATE POLICY "Users can view their own profile" ON public.user_profiles AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = id));
CREATE POLICY "Instructors file their own withdrawal requests" ON public.withdrawal_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = withdrawal_requests.instructor_id) AND (i.user_id = auth.uid()))))));
CREATE POLICY "Instructors view their own withdrawal requests" ON public.withdrawal_requests AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM instructors i
  WHERE ((i.id = withdrawal_requests.instructor_id) AND (i.user_id = auth.uid())))));
CREATE POLICY "Publishers file their own withdrawal requests" ON public.withdrawal_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM publishers p
  WHERE ((p.id = withdrawal_requests.publisher_id) AND (p.user_id = auth.uid()))))));
CREATE POLICY "Publishers view their own withdrawal requests" ON public.withdrawal_requests AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM publishers p
  WHERE ((p.id = withdrawal_requests.publisher_id) AND (p.user_id = auth.uid())))));
CREATE POLICY "Super admin manages withdrawal requests" ON public.withdrawal_requests AS PERMISSIVE FOR ALL TO public
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ════════════════════════════════════════════════════════════
-- ٧. مين يقدر ينفّذ كل دالة
-- Supabase بتدّي أي دالة جديدة للكل (حتى الزائر). بنسحب ده من الكل
-- ونرجّع بالظبط اللي كان على القاعدة القديمة.
-- ════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public.activate_box_subscription FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_box_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_box_subscription TO service_role;
REVOKE ALL ON FUNCTION public.apply_dependent_name_change FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_dependent_name_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_dependent_name_change TO service_role;
REVOKE ALL ON FUNCTION public.block_inactive_product FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.block_inactive_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_inactive_product TO service_role;
REVOKE ALL ON FUNCTION public.block_suspended_purchase FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.block_suspended_purchase TO public;
GRANT EXECUTE ON FUNCTION public.block_suspended_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_suspended_purchase TO service_role;
REVOKE ALL ON FUNCTION public.can_access_service_order FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_service_order TO public;
GRANT EXECUTE ON FUNCTION public.can_access_service_order TO anon;
GRANT EXECUTE ON FUNCTION public.can_access_service_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_service_order TO service_role;
REVOKE ALL ON FUNCTION public.can_see_dependent_request FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_dependent_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_dependent_request TO service_role;
REVOKE ALL ON FUNCTION public.can_see_profile FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_profile TO anon;
GRANT EXECUTE ON FUNCTION public.can_see_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_profile TO service_role;
REVOKE ALL ON FUNCTION public.create_box_subscription_order FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_box_subscription_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_box_subscription_order TO service_role;
REVOKE ALL ON FUNCTION public.create_course_booking FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_course_booking TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_course_booking TO service_role;
REVOKE ALL ON FUNCTION public.create_customer_order FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_customer_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order TO service_role;
REVOKE ALL ON FUNCTION public.guard_course_subscription_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_course_subscription_fields TO public;
GRANT EXECUTE ON FUNCTION public.guard_course_subscription_fields TO anon;
GRANT EXECUTE ON FUNCTION public.guard_course_subscription_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_course_subscription_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_instructor_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_instructor_fields TO public;
GRANT EXECUTE ON FUNCTION public.guard_instructor_fields TO anon;
GRANT EXECUTE ON FUNCTION public.guard_instructor_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_instructor_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_instructor_media FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_instructor_media TO public;
GRANT EXECUTE ON FUNCTION public.guard_instructor_media TO anon;
GRANT EXECUTE ON FUNCTION public.guard_instructor_media TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_instructor_media TO service_role;
REVOKE ALL ON FUNCTION public.guard_order_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_order_fields TO public;
GRANT EXECUTE ON FUNCTION public.guard_order_fields TO anon;
GRANT EXECUTE ON FUNCTION public.guard_order_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_order_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_order_insert FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_order_insert TO public;
GRANT EXECUTE ON FUNCTION public.guard_order_insert TO anon;
GRANT EXECUTE ON FUNCTION public.guard_order_insert TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_order_insert TO service_role;
REVOKE ALL ON FUNCTION public.guard_portfolio_document_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_portfolio_document_fields TO public;
GRANT EXECUTE ON FUNCTION public.guard_portfolio_document_fields TO anon;
GRANT EXECUTE ON FUNCTION public.guard_portfolio_document_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_portfolio_document_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_product_review FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_product_review TO public;
GRANT EXECUTE ON FUNCTION public.guard_product_review TO anon;
GRANT EXECUTE ON FUNCTION public.guard_product_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_product_review TO service_role;
REVOKE ALL ON FUNCTION public.guard_provider_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_provider_fields TO public;
GRANT EXECUTE ON FUNCTION public.guard_provider_fields TO anon;
GRANT EXECUTE ON FUNCTION public.guard_provider_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_provider_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_provider_service_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_provider_service_fields TO public;
GRANT EXECUTE ON FUNCTION public.guard_provider_service_fields TO anon;
GRANT EXECUTE ON FUNCTION public.guard_provider_service_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_provider_service_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_publisher_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_publisher_fields TO public;
GRANT EXECUTE ON FUNCTION public.guard_publisher_fields TO anon;
GRANT EXECUTE ON FUNCTION public.guard_publisher_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_publisher_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_service_order_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_service_order_fields TO public;
GRANT EXECUTE ON FUNCTION public.guard_service_order_fields TO anon;
GRANT EXECUTE ON FUNCTION public.guard_service_order_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_service_order_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_session_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_session_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_session_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_suspension_target FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_suspension_target TO public;
GRANT EXECUTE ON FUNCTION public.guard_suspension_target TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_suspension_target TO service_role;
REVOKE ALL ON FUNCTION public.guard_user_profile_fields FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_user_profile_fields TO public;
GRANT EXECUTE ON FUNCTION public.guard_user_profile_fields TO anon;
GRANT EXECUTE ON FUNCTION public.guard_user_profile_fields TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_user_profile_fields TO service_role;
REVOKE ALL ON FUNCTION public.guard_withdrawal_request FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_withdrawal_request TO public;
GRANT EXECUTE ON FUNCTION public.guard_withdrawal_request TO anon;
GRANT EXECUTE ON FUNCTION public.guard_withdrawal_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_withdrawal_request TO service_role;
REVOKE ALL ON FUNCTION public.guardian_of_student FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guardian_of_student TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_of_student TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO public;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO service_role;
REVOKE ALL ON FUNCTION public.instructor_sessions FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.instructor_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.instructor_sessions TO service_role;
REVOKE ALL ON FUNCTION public.instructor_students FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.instructor_students TO authenticated;
GRANT EXECUTE ON FUNCTION public.instructor_students TO service_role;
REVOKE ALL ON FUNCTION public.instructor_teaches FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.instructor_teaches TO anon;
GRANT EXECUTE ON FUNCTION public.instructor_teaches TO authenticated;
GRANT EXECUTE ON FUNCTION public.instructor_teaches TO service_role;
REVOKE ALL ON FUNCTION public.is_admin FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin TO public;
GRANT EXECUTE ON FUNCTION public.is_admin TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO service_role;
REVOKE ALL ON FUNCTION public.is_instructor FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_instructor TO public;
GRANT EXECUTE ON FUNCTION public.is_instructor TO anon;
GRANT EXECUTE ON FUNCTION public.is_instructor TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_instructor TO service_role;
REVOKE ALL ON FUNCTION public.is_super_admin FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO public;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO service_role;
REVOKE ALL ON FUNCTION public.my_dependent_link FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_dependent_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_dependent_link TO service_role;
REVOKE ALL ON FUNCTION public.next_payment_reference FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_payment_reference TO service_role;
REVOKE ALL ON FUNCTION public.notify_admins FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_admins TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admins TO service_role;
REVOKE ALL ON FUNCTION public.notify_broadcast FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_broadcast TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_broadcast TO service_role;
REVOKE ALL ON FUNCTION public.notify_user FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user TO service_role;
REVOKE ALL ON FUNCTION public.owns_instructor FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_instructor TO public;
GRANT EXECUTE ON FUNCTION public.owns_instructor TO anon;
GRANT EXECUTE ON FUNCTION public.owns_instructor TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_instructor TO service_role;
REVOKE ALL ON FUNCTION public.public_instructor FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_instructor TO service_role;
GRANT EXECUTE ON FUNCTION public.public_instructor TO anon;
GRANT EXECUTE ON FUNCTION public.public_instructor TO authenticated;
REVOKE ALL ON FUNCTION public.public_instructors FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_instructors TO service_role;
GRANT EXECUTE ON FUNCTION public.public_instructors TO anon;
GRANT EXECUTE ON FUNCTION public.public_instructors TO authenticated;
REVOKE ALL ON FUNCTION public.record_order_publisher_earnings FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_order_publisher_earnings TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_publisher_earnings TO service_role;
REVOKE ALL ON FUNCTION public.record_service_order_earning FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_service_order_earning TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_service_order_earning TO service_role;
REVOKE ALL ON FUNCTION public.reset_due_notifications FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_due_notifications TO public;
GRANT EXECUTE ON FUNCTION public.reset_due_notifications TO anon;
GRANT EXECUTE ON FUNCTION public.reset_due_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_due_notifications TO service_role;
REVOKE ALL ON FUNCTION public.set_instructor_packages FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_instructor_packages TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_instructor_packages TO service_role;
REVOKE ALL ON FUNCTION public.snapshot_publisher_share FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snapshot_publisher_share TO authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_publisher_share TO service_role;
REVOKE ALL ON FUNCTION public.student_sessions FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_sessions TO service_role;
REVOKE ALL ON FUNCTION public.sync_guardian_flag FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_guardian_flag TO public;
GRANT EXECUTE ON FUNCTION public.sync_guardian_flag TO anon;
GRANT EXECUTE ON FUNCTION public.sync_guardian_flag TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_guardian_flag TO service_role;
REVOKE ALL ON FUNCTION public.sync_user_email FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_user_email TO public;
GRANT EXECUTE ON FUNCTION public.sync_user_email TO anon;
GRANT EXECUTE ON FUNCTION public.sync_user_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_email TO service_role;


-- ══════════════════════════════════════════════════════════════
-- ٨. صلاحيات على مستوى الجدول (من ملفات 121 و122 و127)
-- ══════════════════════════════════════════════════════════════

REVOKE ALL ON public.instructor_pricing FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.personalized_products FROM anon;
REVOKE ALL ON public.instructor_media FROM anon;
GRANT SELECT ON public.instructor_media TO anon;

COMMIT;

-- ── التأكيد ─────────────────────────────────────────────────
SELECT 'جداول' AS البند, count(*)::text AS العدد, '49' AS المتوقع FROM pg_tables WHERE schemaname = 'public'
UNION ALL SELECT 'جداول بحماية RLS', count(*)::text, '49' FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity
UNION ALL SELECT 'دوال', count(*)::text, '49' FROM pg_proc WHERE pronamespace = 'public'::regnamespace
UNION ALL SELECT 'سياسات', count(*)::text, '143' FROM pg_policies WHERE schemaname = 'public'
UNION ALL SELECT 'محفّزات الجداول', count(*)::text, '24' FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal
UNION ALL SELECT 'محفّزات حسابات الدخول', count(*)::text, '2' FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname IN ('on_auth_user_created', 'on_auth_user_email_sync');
