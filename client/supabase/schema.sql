-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.account_deletion_requests (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'done'::text, 'rejected'::text])),
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  handled_at timestamp with time zone,
  handled_by uuid,
  CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.addon_products (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0::numeric),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  supports_customization boolean NOT NULL DEFAULT true CHECK (supports_customization),
  customization_price numeric NOT NULL DEFAULT 0 CHECK (customization_price >= 0::numeric),
  image_url text CHECK (image_url IS NULL OR image_url ~ '^https://res\.cloudinary\.com/'::text),
  gallery_image_urls ARRAY CHECK (gallery_image_urls IS NULL OR cardinality(gallery_image_urls) <= 8),
  long_description text CHECK (long_description IS NULL OR char_length(long_description) <= 5000),
  features ARRAY CHECK (features IS NULL OR cardinality(features) <= 10),
  CONSTRAINT addon_products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.audit_logs (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  actor_profile_id text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.blog_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  cover_image_url text,
  author_name text NOT NULL DEFAULT 'فريق الرحلة'::text,
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.box_shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  month_number integer NOT NULL CHECK (month_number >= 1),
  goal text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'preparing'::text, 'shipped'::text, 'delivered'::text])),
  tracking_reference text,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT box_shipments_pkey PRIMARY KEY (id),
  CONSTRAINT box_shipments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.box_subscriptions(id)
);
CREATE TABLE public.box_subscription_plans (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  name text NOT NULL,
  price_total numeric NOT NULL,
  price_monthly numeric NOT NULL,
  duration_months integer NOT NULL,
  savings_note text,
  image_url text,
  description text,
  features ARRAY NOT NULL DEFAULT '{}'::text[],
  is_highlighted boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  addon_discount_percent smallint NOT NULL DEFAULT 0 CHECK (addon_discount_percent >= 0 AND addon_discount_percent <= 90),
  free_addon_id text,
  CONSTRAINT box_subscription_plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.box_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  customer_name text NOT NULL,
  plan_name text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'active'::sub_status_enum,
  next_shipment_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  order_id uuid UNIQUE,
  plan_id text,
  months integer,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  addon_discount_percent smallint NOT NULL DEFAULT 0,
  free_addon_name text,
  details jsonb,
  CONSTRAINT box_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT box_subscriptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT box_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.child_profiles (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_profile_id uuid NOT NULL,
  full_name text NOT NULL,
  birth_date date,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  gender text CHECK (gender IS NULL OR (gender = ANY (ARRAY['male'::text, 'female'::text]))),
  account_profile_id text,
  CONSTRAINT child_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT child_profiles_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.course_subscriptions (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  package_id text NOT NULL,
  user_id uuid NOT NULL,
  participant_type text NOT NULL CHECK (participant_type = ANY (ARRAY['self'::text, 'child'::text])),
  child_id text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'awaiting_verification'::text, 'active'::text, 'completed'::text, 'cancelled'::text])),
  started_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  amount numeric,
  transaction_reference text,
  preferred_instructor_id text,
  payment_reference text DEFAULT next_payment_reference(),
  payment_method text CHECK (payment_method IS NULL OR (payment_method = ANY (ARRAY['instapay'::text, 'vodafone_cash'::text]))),
  payment_receipt_url text,
  preferred_slot jsonb,
  gift_message text,
  recording_consent_at timestamp with time zone,
  discount_code text,
  discount_amount numeric NOT NULL DEFAULT 0,
  CONSTRAINT course_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT course_subscriptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.creative_writing_packages(id),
  CONSTRAINT course_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id),
  CONSTRAINT course_subscriptions_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.child_profiles(id)
);
CREATE TABLE public.creative_writing_packages (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  age_group USER-DEFINED NOT NULL,
  price numeric NOT NULL,
  duration_text text,
  sessions_count integer,
  session_duration text,
  target_audience text,
  prerequisite_note text,
  prerequisite_package_id text,
  short_description text,
  full_description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  track text CHECK (track IS NULL OR (track = ANY (ARRAY['foundation'::text, 'youth'::text, 'specialization'::text]))),
  CONSTRAINT creative_writing_packages_pkey PRIMARY KEY (id),
  CONSTRAINT creative_writing_packages_prerequisite_package_id_fkey FOREIGN KEY (prerequisite_package_id) REFERENCES public.creative_writing_packages(id)
);
CREATE TABLE public.dependent_requests (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  child_profile_id text NOT NULL,
  guardian_profile_id uuid NOT NULL,
  requester_profile_id uuid,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['service'::text, 'package'::text, 'name_change'::text, 'product'::text])),
  service_id text,
  provider_id text,
  package_id text,
  instructor_id text,
  preferred_slot jsonb,
  note text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])),
  guardian_note text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  requested_name text,
  product_id text,
  CONSTRAINT dependent_requests_pkey PRIMARY KEY (id),
  CONSTRAINT dependent_requests_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id),
  CONSTRAINT dependent_requests_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id),
  CONSTRAINT dependent_requests_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.creative_writing_packages(id),
  CONSTRAINT dependent_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.service_providers(id),
  CONSTRAINT dependent_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.standalone_services(id),
  CONSTRAINT dependent_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.personalized_products(id)
);
CREATE TABLE public.instructor_certifications (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  instructor_id text NOT NULL UNIQUE,
  training_completed_at timestamp with time zone,
  training_meeting_link text,
  exam_passed boolean NOT NULL DEFAULT false,
  exam_score integer,
  certified_at timestamp with time zone,
  CONSTRAINT instructor_certifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.instructor_media (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  instructor_id text NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['cover'::text, 'work'::text])),
  image_url text NOT NULL,
  title text,
  contribution text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  admin_feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT instructor_media_pkey PRIMARY KEY (id),
  CONSTRAINT instructor_media_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id)
);
CREATE TABLE public.instructor_packages (
  instructor_id text NOT NULL,
  package_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT instructor_packages_pkey PRIMARY KEY (instructor_id, package_id),
  CONSTRAINT instructor_packages_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id),
  CONSTRAINT instructor_packages_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.creative_writing_packages(id)
);
CREATE TABLE public.instructor_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instructor_id text NOT NULL,
  period text NOT NULL,
  amount integer NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payout_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  source_type text,
  source_id text,
  description text,
  CONSTRAINT instructor_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT instructor_payouts_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id)
);
CREATE TABLE public.instructor_pricing (
  instructor_id text NOT NULL,
  approved_price integer,
  requested_price integer,
  monthly_hours_committed integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT instructor_pricing_pkey PRIMARY KEY (instructor_id),
  CONSTRAINT instructor_pricing_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id)
);
CREATE TABLE public.instructor_pricing_options (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  label text NOT NULL,
  base_price_per_session numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT instructor_pricing_options_pkey PRIMARY KEY (id)
);
CREATE TABLE public.instructors (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  bio text NOT NULL,
  specialties ARRAY NOT NULL,
  years_experience integer NOT NULL,
  is_sample boolean DEFAULT false,
  status USER-DEFINED NOT NULL DEFAULT 'pending_training'::instructor_status_enum,
  training_passed boolean DEFAULT false,
  work_model USER-DEFINED NOT NULL DEFAULT 'per_session'::work_model_enum,
  selected_pricing_option_id text,
  weekly_schedule jsonb,
  pending_schedule jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT instructors_pkey PRIMARY KEY (id),
  CONSTRAINT instructors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.join_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  applicant_name text NOT NULL,
  requested_role text NOT NULL CHECK (requested_role = ANY (ARRAY['instructor'::text, 'publisher'::text, 'illustrator'::text, 'voiceover'::text, 'author'::text, 'other'::text])),
  status USER-DEFINED NOT NULL DEFAULT 'pending'::join_request_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  phone text,
  portfolio_url text,
  message text,
  CONSTRAINT join_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  recipient_profile_id text NOT NULL,
  title text NOT NULL,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  link text,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id text NOT NULL,
  quantity integer NOT NULL,
  unit_price integer NOT NULL,
  customization_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  publisher_id_snapshot text,
  publisher_cost_snapshot integer CHECK (publisher_cost_snapshot IS NULL OR publisher_cost_snapshot > 0),
  format text NOT NULL DEFAULT 'printed'::text CHECK (format = ANY (ARRAY['printed'::text, 'electronic'::text, 'both'::text])),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dependent_participant_id text,
  independent_participant_id text,
  total_amount integer NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::order_status_enum,
  transaction_reference text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  recipient_name text,
  recipient_phone text,
  address_line text,
  city text,
  governorate text,
  shipping_notes text,
  shipping_fee numeric NOT NULL DEFAULT 0,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  tracking_reference text,
  admin_notes text,
  payment_reference text DEFAULT next_payment_reference(),
  payment_method text CHECK (payment_method IS NULL OR (payment_method = ANY (ARRAY['instapay'::text, 'vodafone_cash'::text]))),
  payment_receipt_url text,
  delivery_email text,
  electronic_sent_at timestamp with time zone,
  box_plan_id text,
  box_details jsonb,
  discount_code text,
  discount_amount numeric NOT NULL DEFAULT 0,
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);
CREATE TABLE public.page_content (
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT page_content_pkey PRIMARY KEY (key)
);
CREATE TABLE public.personalized_products (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category USER-DEFINED NOT NULL,
  price numeric NOT NULL,
  electronic_price numeric,
  short_description text,
  cover_image_url text,
  publisher_id text,
  owner_type USER-DEFINED NOT NULL DEFAULT 'platform'::owner_type,
  features ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  publisher_cost integer,
  is_active boolean NOT NULL DEFAULT true,
  review_status text NOT NULL DEFAULT 'pending'::text CHECK (review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  review_note text,
  reviewed_at timestamp with time zone,
  gallery_image_urls ARRAY,
  long_description text,
  min_age smallint CHECK (min_age IS NULL OR min_age >= 0 AND min_age <= 20),
  max_age smallint CHECK (max_age IS NULL OR max_age >= 0 AND max_age <= 20),
  previous_slugs ARRAY NOT NULL DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0,
  pending_changes jsonb,
  CONSTRAINT personalized_products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.portfolio_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::document_status_enum,
  instructor_feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_documents_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.pricing_formula_settings (
  id text NOT NULL DEFAULT 'default'::text,
  platform_multiplier numeric NOT NULL DEFAULT 1,
  fixed_admin_fee numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pricing_formula_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profile_update_requests (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  instructor_id text NOT NULL,
  requested_changes jsonb NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::update_request_status,
  admin_feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profile_update_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.provider_services (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  provider_id text NOT NULL,
  service_id text NOT NULL,
  requested_price numeric,
  approved_price numeric,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  is_active boolean NOT NULL DEFAULT true,
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT provider_services_pkey PRIMARY KEY (id),
  CONSTRAINT provider_services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.service_providers(id),
  CONSTRAINT provider_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.standalone_services(id)
);
CREATE TABLE public.publisher_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  publisher_id text NOT NULL,
  period text NOT NULL,
  amount integer NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payout_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  source_type text,
  source_id text,
  description text,
  CONSTRAINT publisher_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT publisher_payouts_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id)
);
CREATE TABLE public.publishers (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id uuid,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  logo_url text,
  bio text NOT NULL,
  is_sample boolean DEFAULT false,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::publisher_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT publishers_pkey PRIMARY KEY (id),
  CONSTRAINT publishers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.reviews (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  dependent_participant_id text,
  independent_participant_id text,
  instructor_id text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  booking_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewer_profile_id text,
  service_order_id text,
  standalone_service_id text,
  service_rating integer CHECK (service_rating IS NULL OR service_rating >= 1 AND service_rating <= 5),
  is_hidden boolean NOT NULL DEFAULT false,
  hidden_reason text,
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_dependent_participant_id_fkey FOREIGN KEY (dependent_participant_id) REFERENCES public.child_profiles(id),
  CONSTRAINT reviews_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id)
);
CREATE TABLE public.service_order_messages (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  order_id text NOT NULL,
  sender_profile_id text NOT NULL,
  body text NOT NULL CHECK (length(TRIM(BOTH FROM body)) > 0),
  is_delivery boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT service_order_messages_pkey PRIMARY KEY (id),
  CONSTRAINT service_order_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id)
);
CREATE TABLE public.service_orders (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  buyer_profile_id text NOT NULL,
  package_id text,
  standalone_service_id text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::service_order_status,
  amount numeric NOT NULL,
  transaction_reference text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
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
  payment_method text CHECK (payment_method IS NULL OR (payment_method = ANY (ARRAY['instapay'::text, 'vodafone_cash'::text]))),
  payment_receipt_url text,
  participant_type text NOT NULL DEFAULT 'self'::text CHECK (participant_type = ANY (ARRAY['self'::text, 'child'::text])),
  child_id text,
  discount_code text,
  discount_amount numeric NOT NULL DEFAULT 0,
  CONSTRAINT service_orders_pkey PRIMARY KEY (id),
  CONSTRAINT service_orders_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id),
  CONSTRAINT service_orders_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.creative_writing_packages(id),
  CONSTRAINT service_orders_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.service_providers(id),
  CONSTRAINT service_orders_standalone_service_id_fkey FOREIGN KEY (standalone_service_id) REFERENCES public.standalone_services(id)
);
CREATE TABLE public.service_providers (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  kind USER-DEFINED NOT NULL,
  user_id uuid,
  instructor_id text,
  display_name text NOT NULL,
  bio text NOT NULL DEFAULT ''::text,
  avatar_url text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::provider_status,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT service_providers_pkey PRIMARY KEY (id),
  CONSTRAINT service_providers_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id),
  CONSTRAINT service_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.session_attachments (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  booking_id text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  CONSTRAINT session_attachments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.session_messages (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  booking_id text NOT NULL,
  sender_profile_id text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.session_reports (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  session_id text NOT NULL UNIQUE,
  instructor_id text NOT NULL,
  attendance text NOT NULL CHECK (attendance = ANY (ARRAY['present'::text, 'absent'::text])),
  report text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_reports_pkey PRIMARY KEY (id),
  CONSTRAINT session_reports_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id),
  CONSTRAINT session_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.sessions (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  course_subscription_id text NOT NULL,
  instructor_id text,
  session_number integer NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  meeting_url text,
  room_name text,
  room_url text,
  recording_id text,
  recording_status text CHECK (recording_status IS NULL OR (recording_status = ANY (ARRAY['pending'::text, 'ready'::text, 'deleted'::text]))),
  recording_expires_at timestamp with time zone,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_course_subscription_id_fkey FOREIGN KEY (course_subscription_id) REFERENCES public.course_subscriptions(id),
  CONSTRAINT sessions_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id)
);
CREATE TABLE public.shipping_rates (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  governorate text NOT NULL,
  fee numeric NOT NULL CHECK (fee >= 0::numeric),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  city text,
  CONSTRAINT shipping_rates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.site_settings (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  CONSTRAINT site_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.standalone_services (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  category text,
  sort_order integer,
  price_type text NOT NULL DEFAULT 'fixed'::text CHECK (price_type = ANY (ARRAY['fixed'::text, 'starts_from'::text])),
  is_active boolean NOT NULL DEFAULT true,
  cover_image_url text,
  gallery_image_urls ARRAY CHECK (gallery_image_urls IS NULL OR cardinality(gallery_image_urls) <= 8),
  long_description text CHECK (long_description IS NULL OR char_length(long_description) <= 5000),
  deliverables ARRAY CHECK (deliverables IS NULL OR cardinality(deliverables) <= 8),
  requirements text CHECK (requirements IS NULL OR char_length(requirements) <= 1500),
  delivery_days smallint CHECK (delivery_days IS NULL OR delivery_days >= 1 AND delivery_days <= 90),
  allows_files boolean NOT NULL DEFAULT false,
  file_max_mb smallint NOT NULL DEFAULT 10 CHECK (file_max_mb >= 1 AND file_max_mb <= 10),
  file_kinds ARRAY NOT NULL DEFAULT ARRAY['pdf'::text, 'word'::text, 'image'::text] CHECK (file_kinds <@ ARRAY['pdf'::text, 'word'::text, 'image'::text] AND cardinality(file_kinds) >= 1),
  CONSTRAINT standalone_services_pkey PRIMARY KEY (id)
);
CREATE TABLE public.study_materials (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  title text NOT NULL,
  description text,
  package_id text,
  CONSTRAINT study_materials_pkey PRIMARY KEY (id),
  CONSTRAINT study_materials_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.creative_writing_packages(id)
);
CREATE TABLE public.support_session_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  message text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::support_session_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_session_requests_pkey PRIMARY KEY (id),
  CONSTRAINT support_session_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.support_ticket_messages (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  ticket_id text NOT NULL,
  sender_profile_id text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  requester_name text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'open'::ticket_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_name text NOT NULL,
  author_role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT testimonials_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_emails (
  user_id uuid NOT NULL,
  email text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_emails_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'visitor'::user_role_enum,
  is_guardian boolean DEFAULT false,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  suspended_at timestamp with time zone,
  suspension_reason text,
  admin_role_id uuid,
  archived_at timestamp with time zone,
  archived_by uuid,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_admin_role_id_fkey FOREIGN KEY (admin_role_id) REFERENCES public.admin_roles(id)
);
CREATE TABLE public.withdrawal_requests (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  instructor_id text,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'rejected'::text])),
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  payout_details text,
  publisher_id text,
  CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id),
  CONSTRAINT withdrawal_requests_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id),
  CONSTRAINT withdrawal_requests_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id)
);
CREATE TABLE public.admin_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(name)) <= 40),
  permissions ARRAY NOT NULL DEFAULT '{}'::text[] CHECK (permissions <@ ARRAY['canManageUsers'::text, 'canManageInstructors'::text, 'canManagePublishers'::text, 'canManageCatalog'::text, 'canManageSubscriptions'::text, 'canManageOrders'::text, 'canManageBookings'::text, 'canManageSupport'::text, 'canManageContent'::text, 'canManageFinance'::text, 'canViewAuditLogs'::text]),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT admin_roles_pkey PRIMARY KEY (id),
  CONSTRAINT admin_roles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.customization_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (char_length(btrim(label)) >= 1 AND char_length(btrim(label)) <= 80),
  placeholder text CHECK (placeholder IS NULL OR char_length(placeholder) <= 120),
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  applies_to ARRAY,
  CONSTRAINT customization_fields_pkey PRIMARY KEY (id)
);
CREATE TABLE public.customer_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  line text NOT NULL CHECK (line = ANY (ARRAY['enha_lak'::text, 'creative_writing'::text])),
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 2000),
  status text NOT NULL DEFAULT 'new'::text CHECK (status = ANY (ARRAY['new'::text, 'seen'::text])),
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  handled_at timestamp with time zone,
  handled_by uuid,
  CONSTRAINT customer_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT customer_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.story_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (char_length(btrim(label)) >= 2 AND char_length(btrim(label)) <= 120),
  applies_to ARRAY,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT story_goals_pkey PRIMARY KEY (id)
);
CREATE TABLE public.discount_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{3,30}$'::text),
  percent integer NOT NULL CHECK (percent >= 1 AND percent <= 90),
  lines ARRAY CHECK (lines IS NULL OR cardinality(lines) >= 1 AND cardinality(lines) <= 4 AND lines <@ ARRAY['enha_lak'::text, 'box'::text, 'courses'::text, 'services'::text]),
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  max_uses integer CHECK (max_uses IS NULL OR max_uses >= 1),
  is_active boolean NOT NULL DEFAULT true,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.discount_code_uses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL,
  user_id uuid NOT NULL,
  line text NOT NULL,
  source_id text NOT NULL,
  discount_amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT discount_code_uses_pkey PRIMARY KEY (id),
  CONSTRAINT discount_code_uses_code_fkey FOREIGN KEY (code_id) REFERENCES public.discount_codes(id)
);
CREATE TABLE public.assignment_rules (
  line text NOT NULL CHECK (line = ANY (ARRAY['enha_lak'::text, 'box'::text, 'courses'::text, 'services'::text])),
  stage text NOT NULL CHECK (stage = ANY (ARRAY['payment'::text, 'fulfilment'::text])),
  profile_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assignment_rules_pkey PRIMARY KEY (line, stage, profile_id),
  CONSTRAINT assignment_rules_profile_fkey FOREIGN KEY (profile_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.work_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  line text NOT NULL CHECK (line = ANY (ARRAY['enha_lak'::text, 'box'::text, 'courses'::text, 'services'::text])),
  stage text NOT NULL CHECK (stage = ANY (ARRAY['payment'::text, 'fulfilment'::text])),
  source_id text NOT NULL,
  reference text,
  title text NOT NULL,
  link text NOT NULL,
  assignee_ids ARRAY NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'done'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  done_at timestamp with time zone,
  done_by uuid,
  CONSTRAINT work_tasks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.session_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  requester_profile_id uuid NOT NULL,
  requester_role text NOT NULL CHECK (requester_role = ANY (ARRAY['guardian'::text, 'instructor'::text, 'student'::text])),
  proposed_at timestamp with time zone NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3 AND length(btrim(reason)) <= 1000),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])),
  admin_note text,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT session_change_requests_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.private_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id text,
  document_id uuid,
  uploader_profile_id text NOT NULL,
  file_name text NOT NULL CHECK (char_length(file_name) >= 1 AND char_length(file_name) <= 200),
  public_id text NOT NULL UNIQUE,
  resource_type text NOT NULL CHECK (resource_type = ANY (ARRAY['raw'::text, 'image'::text])),
  format text,
  bytes integer NOT NULL CHECK (bytes > 0 AND bytes <= (10 * 1024 * 1024)),
  is_delivery boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT private_files_pkey PRIMARY KEY (id),
  CONSTRAINT private_files_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id),
  CONSTRAINT private_files_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.portfolio_documents(id)
);