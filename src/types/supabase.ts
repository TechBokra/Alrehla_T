export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * شكل قاعدة البيانات كما هي فعلًا (مشروع xxptugdbtzkjyydveprp).
 *
 * ⚠️ الملف ده المفروض يتولّد تلقائيًا:
 *
 *     npx supabase gen types typescript --project-id xxptugdbtzkjyydveprp
 *
 * لكنه اتعدّل بإيد أكتر من مرة لما اتضافت جداول جديدة. آخر مطابقة كاملة
 * مع قاعدة البيانات الحقيقية كانت في سبتمبر 2026، وطلعت **صفر فروق**:
 * 44 جدول، كل عمود بنوعه وحالة السماح بالفراغ.
 *
 * ليه ده مهم: نسخة قديمة من الملف ده هي اللي سمحت قبل كده بكتابة كود
 * على أعمدة مش موجودة (child_profiles.name و .age)، والكود ده وصل
 * للإنتاج مكسور.
 *
 * القاعدة: أي تعديل على قاعدة البيانات لازم يتبعه تحديث هنا، والأفضل
 * بالتوليد التلقائي مش بالإيد.
 */
export type Database = {
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          id: string
          user_id: string
          reason: string | null
          status: string
          admin_notes: string | null
          created_at: string
          handled_at: string | null
          handled_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          reason?: string | null
          status?: string
          admin_notes?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          reason?: string | null
          status?: string
          admin_notes?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
        }
        Relationships: []
      }
      addon_products: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          price: number
          is_active: boolean
          sort_order: number
          supports_customization: boolean
          customization_price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description?: string | null
          price?: number
          is_active?: boolean
          sort_order?: number
          supports_customization?: boolean
          customization_price?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          description?: string | null
          price?: number
          is_active?: boolean
          sort_order?: number
          supports_customization?: boolean
          customization_price?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_profile_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_profile_id?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_profile_id?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          id: string
          slug: string
          title: string
          excerpt: string
          content: string
          cover_image_url: string | null
          author_name: string
          published_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          excerpt: string
          content: string
          cover_image_url?: string | null
          author_name?: string
          published_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          excerpt?: string
          content?: string
          cover_image_url?: string | null
          author_name?: string
          published_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          dependent_participant_id: string | null
          independent_participant_id: string | null
          package_id: string
          instructor_id: string | null
          course_subscription_id: string | null
          status: Database["public"]["Enums"]["booking_status_enum"]
          scheduled_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dependent_participant_id?: string | null
          independent_participant_id?: string | null
          package_id: string
          instructor_id?: string | null
          course_subscription_id?: string | null
          status?: Database["public"]["Enums"]["booking_status_enum"]
          scheduled_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dependent_participant_id?: string | null
          independent_participant_id?: string | null
          package_id?: string
          instructor_id?: string | null
          course_subscription_id?: string | null
          status?: Database["public"]["Enums"]["booking_status_enum"]
          scheduled_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      box_subscription_plans: {
        Row: {
          id: string
          name: string
          price_total: number
          price_monthly: number
          duration_months: number
          savings_note: string | null
          image_url: string | null
          description: string | null
          features: string[]
          is_highlighted: boolean
          is_active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          price_total: number
          price_monthly: number
          duration_months: number
          savings_note?: string | null
          image_url?: string | null
          description?: string | null
          features?: string[]
          is_highlighted?: boolean
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          price_total?: number
          price_monthly?: number
          duration_months?: number
          savings_note?: string | null
          image_url?: string | null
          description?: string | null
          features?: string[]
          is_highlighted?: boolean
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      box_subscriptions: {
        Row: {
          id: string
          user_id: string | null
          customer_name: string
          plan_name: string
          status: Database["public"]["Enums"]["sub_status_enum"]
          next_shipment_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          customer_name: string
          plan_name: string
          status?: Database["public"]["Enums"]["sub_status_enum"]
          next_shipment_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          customer_name?: string
          plan_name?: string
          status?: Database["public"]["Enums"]["sub_status_enum"]
          next_shipment_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      child_profiles: {
        Row: {
          id: string
          user_profile_id: string
          full_name: string
          birth_date: string | null
          gender: string | null
          avatar_url: string | null
          created_at: string
          account_profile_id: string | null
        }
        Insert: {
          id?: string
          user_profile_id: string
          full_name: string
          birth_date?: string | null
          gender?: string | null
          avatar_url?: string | null
          created_at?: string
          account_profile_id?: string | null
        }
        Update: {
          id?: string
          user_profile_id?: string
          full_name?: string
          birth_date?: string | null
          gender?: string | null
          avatar_url?: string | null
          created_at?: string
          account_profile_id?: string | null
        }
        Relationships: []
      }
      course_subscriptions: {
        Row: {
          id: string
          package_id: string
          user_id: string
          participant_type: string
          child_id: string | null
          status: string
          started_at: string | null
          created_at: string
          amount: number | null
          transaction_reference: string | null
          preferred_instructor_id: string | null
          payment_reference: string | null
          payment_method: string | null
          payment_receipt_url: string | null
          preferred_slot: Json | null
          /** إهداء خاص — ملف SQL 86. */
          gift_message: string | null
          /** وقت موافقة ولي الأمر على تسجيل الجلسات — SQL 111.
           *  فاضي = مفيش موافقة مسجّلة (حجز قبل تفعيل الميزة). */
          recording_consent_at: string | null
        }
        Insert: {
          id?: string
          package_id: string
          user_id: string
          participant_type: string
          child_id?: string | null
          status?: string
          started_at?: string | null
          created_at?: string
          amount?: number | null
          transaction_reference?: string | null
          preferred_instructor_id?: string | null
          payment_reference?: string | null
          payment_method?: string | null
          payment_receipt_url?: string | null
          preferred_slot?: Json | null
          gift_message?: string | null
          recording_consent_at?: string | null
        }
        Update: {
          id?: string
          package_id?: string
          user_id?: string
          participant_type?: string
          child_id?: string | null
          status?: string
          started_at?: string | null
          created_at?: string
          amount?: number | null
          transaction_reference?: string | null
          preferred_instructor_id?: string | null
          payment_reference?: string | null
          payment_method?: string | null
          payment_receipt_url?: string | null
          preferred_slot?: Json | null
          gift_message?: string | null
          recording_consent_at?: string | null
        }
        Relationships: []
      }
      creative_writing_packages: {
        Row: {
          id: string
          slug: string
          name: string
          age_group: Database["public"]["Enums"]["age_group"]
          price: number
          duration_text: string | null
          sessions_count: number | null
          session_duration: string | null
          target_audience: string | null
          prerequisite_note: string | null
          prerequisite_package_id: string | null
          short_description: string | null
          full_description: string | null
          track: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          age_group: Database["public"]["Enums"]["age_group"]
          price: number
          duration_text?: string | null
          sessions_count?: number | null
          session_duration?: string | null
          target_audience?: string | null
          prerequisite_note?: string | null
          prerequisite_package_id?: string | null
          short_description?: string | null
          full_description?: string | null
          track?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          age_group?: Database["public"]["Enums"]["age_group"]
          price?: number
          duration_text?: string | null
          sessions_count?: number | null
          session_duration?: string | null
          target_audience?: string | null
          prerequisite_note?: string | null
          prerequisite_package_id?: string | null
          short_description?: string | null
          full_description?: string | null
          track?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      dependent_requests: {
        Row: {
          id: string
          child_profile_id: string
          guardian_profile_id: string
          requester_profile_id: string | null
          kind: string
          service_id: string | null
          provider_id: string | null
          package_id: string | null
          instructor_id: string | null
          preferred_slot: Json | null
          note: string | null
          /** الاسم المطلوب — لطلبات name_change (ملف SQL 93). */
          requested_name: string | null
          status: string
          guardian_note: string | null
          decided_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          child_profile_id: string
          guardian_profile_id: string
          requester_profile_id?: string | null
          kind: string
          service_id?: string | null
          provider_id?: string | null
          package_id?: string | null
          instructor_id?: string | null
          preferred_slot?: Json | null
          note?: string | null
          requested_name?: string | null
          status?: string
          guardian_note?: string | null
          decided_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          child_profile_id?: string
          guardian_profile_id?: string
          requester_profile_id?: string | null
          kind?: string
          service_id?: string | null
          provider_id?: string | null
          package_id?: string | null
          instructor_id?: string | null
          preferred_slot?: Json | null
          note?: string | null
          requested_name?: string | null
          status?: string
          guardian_note?: string | null
          decided_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependent_requests_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      instructor_certifications: {
        Row: {
          id: string
          instructor_id: string
          training_completed_at: string | null
          training_meeting_link: string | null
          exam_passed: boolean
          exam_score: number | null
          certified_at: string | null
        }
        Insert: {
          id?: string
          instructor_id: string
          training_completed_at?: string | null
          training_meeting_link?: string | null
          exam_passed?: boolean
          exam_score?: number | null
          certified_at?: string | null
        }
        Update: {
          id?: string
          instructor_id?: string
          training_completed_at?: string | null
          training_meeting_link?: string | null
          exam_passed?: boolean
          exam_score?: number | null
          certified_at?: string | null
        }
        Relationships: []
      }
      instructor_compensation_profiles: {
        Row: {
          id: string
          instructor_id: string
          billing_model: Database["public"]["Enums"]["compensation_billing_model"]
          selected_pricing_option_id: string | null
          monthly_minimum_hours: number | null
          overtime_rate_per_hour: number | null
          approval_status: Database["public"]["Enums"]["compensation_approval_status"]
          admin_notes: string | null
          reviewed_by_profile_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          instructor_id: string
          billing_model: Database["public"]["Enums"]["compensation_billing_model"]
          selected_pricing_option_id?: string | null
          monthly_minimum_hours?: number | null
          overtime_rate_per_hour?: number | null
          approval_status?: Database["public"]["Enums"]["compensation_approval_status"]
          admin_notes?: string | null
          reviewed_by_profile_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          instructor_id?: string
          billing_model?: Database["public"]["Enums"]["compensation_billing_model"]
          selected_pricing_option_id?: string | null
          monthly_minimum_hours?: number | null
          overtime_rate_per_hour?: number | null
          approval_status?: Database["public"]["Enums"]["compensation_approval_status"]
          admin_notes?: string | null
          reviewed_by_profile_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      instructor_payouts: {
        Row: {
          id: string
          instructor_id: string
          period: string
          amount: number
          status: Database["public"]["Enums"]["payout_status_enum"]
          created_at: string
          updated_at: string
          source_type: string | null
          source_id: string | null
          description: string | null
        }
        Insert: {
          id?: string
          instructor_id: string
          period: string
          amount: number
          status?: Database["public"]["Enums"]["payout_status_enum"]
          created_at?: string
          updated_at?: string
          source_type?: string | null
          source_id?: string | null
          description?: string | null
        }
        Update: {
          id?: string
          instructor_id?: string
          period?: string
          amount?: number
          status?: Database["public"]["Enums"]["payout_status_enum"]
          created_at?: string
          updated_at?: string
          source_type?: string | null
          source_id?: string | null
          description?: string | null
        }
        Relationships: []
      }
      instructor_pricing_options: {
        Row: {
          id: string
          label: string
          base_price_per_session: number
          is_active: boolean
        }
        Insert: {
          id?: string
          label: string
          base_price_per_session: number
          is_active?: boolean
        }
        Update: {
          id?: string
          label?: string
          base_price_per_session?: number
          is_active?: boolean
        }
        Relationships: []
      }
      instructor_services: {
        Row: {
          id: string
          instructor_id: string
          service_id: string
          requested_price: number | null
          approved_price: number | null
          status: string
          is_active: boolean
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          instructor_id: string
          service_id: string
          requested_price?: number | null
          approved_price?: number | null
          status?: string
          is_active?: boolean
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          instructor_id?: string
          service_id?: string
          requested_price?: number | null
          approved_price?: number | null
          status?: string
          is_active?: boolean
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      instructor_weekly_slots: {
        Row: {
          id: string
          instructor_id: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          time: string
          is_booked: boolean
          commitment_type: Database["public"]["Enums"]["commitment_type"] | null
          commitment_months: number | null
          commitment_ends_at: string | null
          is_pending_change: boolean
        }
        Insert: {
          id?: string
          instructor_id: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          time: string
          is_booked?: boolean
          commitment_type?: Database["public"]["Enums"]["commitment_type"] | null
          commitment_months?: number | null
          commitment_ends_at?: string | null
          is_pending_change?: boolean
        }
        Update: {
          id?: string
          instructor_id?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          time?: string
          is_booked?: boolean
          commitment_type?: Database["public"]["Enums"]["commitment_type"] | null
          commitment_months?: number | null
          commitment_ends_at?: string | null
          is_pending_change?: boolean
        }
        Relationships: []
      }
      instructors: {
        Row: {
          id: string
          user_id: string
          display_name: string
          bio: string
          specialties: string[]
          years_experience: number
          is_sample: boolean | null
          status: Database["public"]["Enums"]["instructor_status_enum"]
          training_passed: boolean | null
          work_model: Database["public"]["Enums"]["work_model_enum"]
          requested_price: number | null
          selected_pricing_option_id: string | null
          approved_price: number | null
          weekly_schedule: Json | null
          pending_schedule: Json | null
          monthly_hours_committed: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name: string
          bio: string
          specialties: string[]
          years_experience: number
          is_sample?: boolean | null
          status?: Database["public"]["Enums"]["instructor_status_enum"]
          training_passed?: boolean | null
          work_model?: Database["public"]["Enums"]["work_model_enum"]
          requested_price?: number | null
          selected_pricing_option_id?: string | null
          approved_price?: number | null
          weekly_schedule?: Json | null
          pending_schedule?: Json | null
          monthly_hours_committed?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string
          bio?: string
          specialties?: string[]
          years_experience?: number
          is_sample?: boolean | null
          status?: Database["public"]["Enums"]["instructor_status_enum"]
          training_passed?: boolean | null
          work_model?: Database["public"]["Enums"]["work_model_enum"]
          requested_price?: number | null
          selected_pricing_option_id?: string | null
          approved_price?: number | null
          weekly_schedule?: Json | null
          pending_schedule?: Json | null
          monthly_hours_committed?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      join_requests: {
        Row: {
          id: string
          applicant_name: string
          requested_role: string
          status: Database["public"]["Enums"]["join_request_status_enum"]
          created_at: string
          updated_at: string
          email: string | null
          phone: string | null
          portfolio_url: string | null
          message: string | null
        }
        Insert: {
          id?: string
          applicant_name: string
          requested_role: string
          status?: Database["public"]["Enums"]["join_request_status_enum"]
          created_at?: string
          updated_at?: string
          email?: string | null
          phone?: string | null
          portfolio_url?: string | null
          message?: string | null
        }
        Update: {
          id?: string
          applicant_name?: string
          requested_role?: string
          status?: Database["public"]["Enums"]["join_request_status_enum"]
          created_at?: string
          updated_at?: string
          email?: string | null
          phone?: string | null
          portfolio_url?: string | null
          message?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          recipient_profile_id: string
          title: string
          message: string | null
          is_read: boolean
          created_at: string
          link: string | null
        }
        Insert: {
          id?: string
          recipient_profile_id: string
          title: string
          message?: string | null
          is_read?: boolean
          created_at?: string
          link?: string | null
        }
        Update: {
          id?: string
          recipient_profile_id?: string
          title?: string
          message?: string | null
          is_read?: boolean
          created_at?: string
          link?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          customization_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          customization_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          customization_data?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          user_id: string
          dependent_participant_id: string | null
          independent_participant_id: string | null
          total_amount: number
          status: Database["public"]["Enums"]["order_status_enum"]
          transaction_reference: string | null
          created_at: string
          updated_at: string
          recipient_name: string | null
          recipient_phone: string | null
          address_line: string | null
          city: string | null
          governorate: string | null
          shipping_notes: string | null
          shipping_fee: number
          shipped_at: string | null
          delivered_at: string | null
          tracking_reference: string | null
          admin_notes: string | null
          payment_reference: string | null
          payment_method: string | null
          payment_receipt_url: string | null
        }
        Insert: {
          id?: string
          user_id: string
          dependent_participant_id?: string | null
          independent_participant_id?: string | null
          total_amount: number
          status?: Database["public"]["Enums"]["order_status_enum"]
          transaction_reference?: string | null
          created_at?: string
          updated_at?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          address_line?: string | null
          city?: string | null
          governorate?: string | null
          shipping_notes?: string | null
          shipping_fee?: number
          shipped_at?: string | null
          delivered_at?: string | null
          tracking_reference?: string | null
          admin_notes?: string | null
          payment_reference?: string | null
          payment_method?: string | null
          payment_receipt_url?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          dependent_participant_id?: string | null
          independent_participant_id?: string | null
          total_amount?: number
          status?: Database["public"]["Enums"]["order_status_enum"]
          transaction_reference?: string | null
          created_at?: string
          updated_at?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          address_line?: string | null
          city?: string | null
          governorate?: string | null
          shipping_notes?: string | null
          shipping_fee?: number
          shipped_at?: string | null
          delivered_at?: string | null
          tracking_reference?: string | null
          admin_notes?: string | null
          payment_reference?: string | null
          payment_method?: string | null
          payment_receipt_url?: string | null
        }
        Relationships: []
      }
      page_content: {
        Row: {
          key: string
          value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      personalized_products: {
        Row: {
          id: string
          slug: string
          name: string
          category: Database["public"]["Enums"]["product_category"]
          price: number
          electronic_price: number | null
          short_description: string | null
          cover_image_url: string | null
          publisher_id: string | null
          owner_type: Database["public"]["Enums"]["owner_type"]
          features: string[] | null
          /** نصيب الناشر من النسخة الواحدة — ملف SQL 97. */
          publisher_cost: number | null
          /** معروض للبيع — SQL 121. الموقوف بيترفض في الطلبات بمحفّز. */
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          is_active?: boolean
          category: Database["public"]["Enums"]["product_category"]
          price: number
          electronic_price?: number | null
          short_description?: string | null
          cover_image_url?: string | null
          publisher_id?: string | null
          owner_type?: Database["public"]["Enums"]["owner_type"]
          features?: string[] | null
          publisher_cost?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          category?: Database["public"]["Enums"]["product_category"]
          price?: number
          electronic_price?: number | null
          short_description?: string | null
          cover_image_url?: string | null
          publisher_id?: string | null
          owner_type?: Database["public"]["Enums"]["owner_type"]
          features?: string[] | null
          publisher_cost?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_documents: {
        Row: {
          id: string
          student_id: string
          title: string
          content: string
          status: Database["public"]["Enums"]["document_status_enum"]
          instructor_feedback: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          title: string
          content: string
          status?: Database["public"]["Enums"]["document_status_enum"]
          instructor_feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          title?: string
          content?: string
          status?: Database["public"]["Enums"]["document_status_enum"]
          instructor_feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_formula_settings: {
        Row: {
          id: string
          platform_multiplier: number
          fixed_admin_fee: number
          updated_at: string
        }
        Insert: {
          id?: string
          platform_multiplier?: number
          fixed_admin_fee?: number
          updated_at?: string
        }
        Update: {
          id?: string
          platform_multiplier?: number
          fixed_admin_fee?: number
          updated_at?: string
        }
        Relationships: []
      }
      profile_update_requests: {
        Row: {
          id: string
          instructor_id: string
          requested_changes: Json
          status: Database["public"]["Enums"]["update_request_status"]
          admin_feedback: string | null
          created_at: string
        }
        Insert: {
          id?: string
          instructor_id: string
          requested_changes: Json
          status?: Database["public"]["Enums"]["update_request_status"]
          admin_feedback?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          instructor_id?: string
          requested_changes?: Json
          status?: Database["public"]["Enums"]["update_request_status"]
          admin_feedback?: string | null
          created_at?: string
        }
        Relationships: []
      }
      publisher_payouts: {
        Row: {
          id: string
          publisher_id: string
          period: string
          amount: number
          status: Database["public"]["Enums"]["payout_status_enum"]
          /** مصدر المستحق ورقمه — ملف SQL 97، وعليهم الفهرس الفريد. */
          source_type: string | null
          source_id: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          publisher_id: string
          period: string
          amount: number
          status?: Database["public"]["Enums"]["payout_status_enum"]
          source_type?: string | null
          source_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          publisher_id?: string
          period?: string
          amount?: number
          status?: Database["public"]["Enums"]["payout_status_enum"]
          source_type?: string | null
          source_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      publishers: {
        Row: {
          id: string
          user_id: string | null
          slug: string
          name: string
          logo_url: string | null
          bio: string
          is_sample: boolean | null
          status: Database["public"]["Enums"]["publisher_status_enum"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          slug: string
          name: string
          logo_url?: string | null
          bio: string
          is_sample?: boolean | null
          status?: Database["public"]["Enums"]["publisher_status_enum"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          slug?: string
          name?: string
          logo_url?: string | null
          bio?: string
          is_sample?: boolean | null
          status?: Database["public"]["Enums"]["publisher_status_enum"]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          dependent_participant_id: string | null
          independent_participant_id: string | null
          instructor_id: string
          rating: number
          comment: string | null
          booking_id: string | null
          created_at: string
          reviewer_profile_id: string | null
          service_order_id: string | null
          standalone_service_id: string | null
          service_rating: number | null
          is_hidden: boolean
          hidden_reason: string | null
        }
        Insert: {
          id?: string
          dependent_participant_id?: string | null
          independent_participant_id?: string | null
          instructor_id: string
          rating: number
          comment?: string | null
          booking_id?: string | null
          created_at?: string
          reviewer_profile_id?: string | null
          service_order_id?: string | null
          standalone_service_id?: string | null
          service_rating?: number | null
          is_hidden?: boolean
          hidden_reason?: string | null
        }
        Update: {
          id?: string
          dependent_participant_id?: string | null
          independent_participant_id?: string | null
          instructor_id?: string
          rating?: number
          comment?: string | null
          booking_id?: string | null
          created_at?: string
          reviewer_profile_id?: string | null
          service_order_id?: string | null
          standalone_service_id?: string | null
          service_rating?: number | null
          is_hidden?: boolean
          hidden_reason?: string | null
        }
        Relationships: []
      }
      service_providers: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["provider_kind"]
          user_id: string | null
          instructor_id: string | null
          display_name: string
          bio: string
          avatar_url: string | null
          status: Database["public"]["Enums"]["provider_status"]
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kind: Database["public"]["Enums"]["provider_kind"]
          user_id?: string | null
          instructor_id?: string | null
          display_name: string
          bio?: string
          avatar_url?: string | null
          status?: Database["public"]["Enums"]["provider_status"]
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kind?: Database["public"]["Enums"]["provider_kind"]
          user_id?: string | null
          instructor_id?: string | null
          display_name?: string
          bio?: string
          avatar_url?: string | null
          status?: Database["public"]["Enums"]["provider_status"]
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_services: {
        Row: {
          id: string
          provider_id: string
          service_id: string
          requested_price: number | null
          approved_price: number | null
          status: string
          is_active: boolean
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider_id: string
          service_id: string
          requested_price?: number | null
          approved_price?: number | null
          status?: string
          is_active?: boolean
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider_id?: string
          service_id?: string
          requested_price?: number | null
          approved_price?: number | null
          status?: string
          is_active?: boolean
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_order_messages: {
        Row: {
          id: string
          order_id: string
          sender_profile_id: string
          body: string
          is_delivery: boolean
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          sender_profile_id: string
          body: string
          is_delivery?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          sender_profile_id?: string
          body?: string
          is_delivery?: boolean
          created_at?: string
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          id: string
          buyer_profile_id: string
          package_id: string | null
          standalone_service_id: string | null
          status: Database["public"]["Enums"]["service_order_status"]
          amount: number
          transaction_reference: string | null
          created_at: string
          instructor_id: string | null
          delivered_at: string | null
          completed_at: string | null
          instructor_earning: number | null
          provider_id: string | null
          due_at: string | null
          due_note: string | null
          due_warned_at: string | null
          due_overdue_notified_at: string | null
          payment_reference: string | null
          payment_method: string | null
          payment_receipt_url: string | null
          participant_type: string
          child_id: string | null
        }
        Insert: {
          id?: string
          buyer_profile_id: string
          package_id?: string | null
          standalone_service_id?: string | null
          status?: Database["public"]["Enums"]["service_order_status"]
          amount: number
          transaction_reference?: string | null
          created_at?: string
          instructor_id?: string | null
          delivered_at?: string | null
          completed_at?: string | null
          instructor_earning?: number | null
          provider_id?: string | null
          due_at?: string | null
          due_note?: string | null
          due_warned_at?: string | null
          due_overdue_notified_at?: string | null
          payment_reference?: string | null
          payment_method?: string | null
          payment_receipt_url?: string | null
          participant_type?: string
          child_id?: string | null
        }
        Update: {
          id?: string
          buyer_profile_id?: string
          package_id?: string | null
          standalone_service_id?: string | null
          status?: Database["public"]["Enums"]["service_order_status"]
          amount?: number
          transaction_reference?: string | null
          created_at?: string
          instructor_id?: string | null
          delivered_at?: string | null
          completed_at?: string | null
          instructor_earning?: number | null
          provider_id?: string | null
          due_at?: string | null
          due_note?: string | null
          due_warned_at?: string | null
          due_overdue_notified_at?: string | null
          payment_reference?: string | null
          payment_method?: string | null
          payment_receipt_url?: string | null
          participant_type?: string
          child_id?: string | null
        }
        Relationships: []
      }
      session_attachments: {
        Row: {
          id: string
          booking_id: string
          file_name: string
          file_url: string
        }
        Insert: {
          id?: string
          booking_id: string
          file_name: string
          file_url: string
        }
        Update: {
          id?: string
          booking_id?: string
          file_name?: string
          file_url?: string
        }
        Relationships: []
      }
      session_messages: {
        Row: {
          id: string
          booking_id: string
          sender_profile_id: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          sender_profile_id: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          sender_profile_id?: string
          message?: string
          created_at?: string
        }
        Relationships: []
      }
      session_reports: {
        Row: {
          id: string
          session_id: string
          instructor_id: string
          attendance: string
          report: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          instructor_id: string
          attendance: string
          report?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          instructor_id?: string
          attendance?: string
          report?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          id: string
          governorate: string
          fee: number
          is_active: boolean
          updated_at: string
          city: string | null
        }
        Insert: {
          id?: string
          governorate: string
          fee: number
          is_active?: boolean
          updated_at?: string
          city?: string | null
        }
        Update: {
          id?: string
          governorate?: string
          fee?: number
          is_active?: boolean
          updated_at?: string
          city?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          course_subscription_id: string
          instructor_id: string | null
          session_number: number
          scheduled_at: string
          status: string
          created_at: string
          updated_at: string | null
          meeting_url: string | null
          /** اسم الغرفة عند Daily — SQL 111. */
          room_name: string | null
          room_url: string | null
          recording_id: string | null
          recording_status: string | null
          /** بيتحسب وقت الجلسة لا وقت الحذف — SQL 111. */
          recording_expires_at: string | null
        }
        Insert: {
          id?: string
          course_subscription_id: string
          instructor_id?: string | null
          session_number: number
          scheduled_at: string
          status?: string
          created_at?: string
          updated_at?: string | null
          meeting_url?: string | null
          room_name?: string | null
          room_url?: string | null
          recording_id?: string | null
          recording_status?: string | null
          recording_expires_at?: string | null
        }
        Update: {
          id?: string
          course_subscription_id?: string
          instructor_id?: string | null
          session_number?: number
          scheduled_at?: string
          status?: string
          created_at?: string
          updated_at?: string | null
          meeting_url?: string | null
          room_name?: string | null
          room_url?: string | null
          recording_id?: string | null
          recording_status?: string | null
          recording_expires_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      standalone_services: {
        Row: {
          id: string
          name: string
          price: number
          description: string | null
          category: string | null
          sort_order: number | null
          price_type: string
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          price: number
          description?: string | null
          category?: string | null
          sort_order?: number | null
          price_type?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          price?: number
          description?: string | null
          category?: string | null
          sort_order?: number | null
          price_type?: string
          is_active?: boolean
        }
        Relationships: []
      }
      study_materials: {
        Row: {
          id: string
          title: string
          description: string | null
          package_id: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          package_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          package_id?: string | null
        }
        Relationships: []
      }
      support_session_requests: {
        Row: {
          id: string
          user_id: string | null
          contact_name: string
          contact_phone: string
          message: string
          status: Database["public"]["Enums"]["support_session_status_enum"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          contact_name: string
          contact_phone: string
          message: string
          status?: Database["public"]["Enums"]["support_session_status_enum"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          contact_name?: string
          contact_phone?: string
          message?: string
          status?: Database["public"]["Enums"]["support_session_status_enum"]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          sender_profile_id: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          sender_profile_id: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          sender_profile_id?: string
          message?: string
          created_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string | null
          requester_name: string
          subject: string
          category: string
          status: Database["public"]["Enums"]["ticket_status_enum"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          requester_name: string
          subject: string
          category: string
          status?: Database["public"]["Enums"]["ticket_status_enum"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          requester_name?: string
          subject?: string
          category?: string
          status?: Database["public"]["Enums"]["ticket_status_enum"]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          id: string
          author_name: string
          author_role: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          author_name: string
          author_role: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          author_name?: string
          author_role?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      user_emails: {
        Row: {
          user_id: string
          email: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          full_name: string
          role: Database["public"]["Enums"]["user_role_enum"]
          is_guardian: boolean | null
          avatar_url: string | null
          permissions: string[] | null
          created_at: string
          updated_at: string
          /** موقوف عن الشراء من التاريخ ده — SQL 118. الدخول مابيتمنعش. */
          suspended_at: string | null
          suspension_reason: string | null
        }
        Insert: {
          id: string
          full_name: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          is_guardian?: boolean | null
          avatar_url?: string | null
          permissions?: string[] | null
          created_at?: string
          updated_at?: string
          suspended_at?: string | null
          suspension_reason?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          is_guardian?: boolean | null
          avatar_url?: string | null
          permissions?: string[] | null
          created_at?: string
          updated_at?: string
          suspended_at?: string | null
          suspension_reason?: string | null
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          id: string
          /** واحد بس من دول متملّي — قيد في القاعدة، ملف SQL 100. */
          instructor_id: string | null
          publisher_id: string | null
          /** بيتكتب في محفّز `guard_withdrawal_request` من الرصيد الحقيقي (ملف 100). */
          amount: number
          method: string
          status: string
          /** بيانات التحويل اللي صاحب الطلب كتبها — ملف SQL 92. */
          payout_details: string | null
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          instructor_id?: string | null
          publisher_id?: string | null
          amount: number
          method: string
          status?: string
          payout_details?: string | null
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          instructor_id?: string | null
          publisher_id?: string | null
          amount?: number
          method?: string
          status?: string
          payout_details?: string | null
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_instructor: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      notify_user: {
        Args: {
          p_recipient: string
          p_title: string
          p_message?: string | null
          p_link?: string | null
        }
        Returns: undefined
      }
      notify_broadcast: {
        Args: {
          p_title: string
          p_message?: string | null
          p_link?: string | null
          p_role?: string | null
        }
        Returns: number
      }
      notify_admins: {
        Args: {
          p_title: string
          p_message?: string | null
          p_link?: string | null
        }
        Returns: number
      }
      create_course_booking: {
        Args: {
          p_package_id: string
          p_instructor_id?: string | null
          p_participant_type?: string | null
          p_child_id?: string | null
          /** إهداء خاص — اتضاف في ملف SQL 86، والقاعدة بتقصّه على 500 حرف. */
          p_gift_message?: string | null
        }
        Returns: string
      }
      create_customer_order: {
        Args: {
          p_items: Json
          p_shipping?: Json | null
        }
        Returns: string
      }
      /**
       * بيانات المدربين العامة — الأعمدة الآمنة وحدها (ملف SQL 83).
       *
       * ⚠️ الملف ده بيتولّد بـ`supabase gen types`، والمدخلتين دول
       *    اتكتبوا بالإيد لأن التوليد مبيتعملش من هنا. لو اتعمل توليد
       *    يومًا، اتأكد إنهم لسه موجودين.
       */
      /**
       * تسجيل مستحق المدرب لطلب خدمة مكتمل — ملف SQL 91.
       *
       * ⚠️ اتكتبت بالإيد زي `public_instructors` تحت.
       */
      record_service_order_earning: {
        Args: { p_order_id: string }
        Returns: Json
      }
      /** مستحقات ناشري طلب مسلَّم — ملف SQL 97. */
      record_order_publisher_earnings: {
        Args: { p_order_id: string }
        Returns: Json
      }
      /** باقات المدرب — استبدال دفعة واحدة، ملف SQL 102. */
      set_instructor_packages: {
        Args: { p_instructor_id: string; p_package_ids: string[] }
        Returns: Json
      }
      /** موافقة ولي الأمر على تغيير اسم ابنه — ملف SQL 93. */
      apply_dependent_name_change: {
        Args: { p_request_id: string }
        Returns: Json
      }
      public_instructors: {
        Args: Record<string, never>
        Returns: {
          id: string
          user_id: string
          display_name: string
          bio: string | null
          specialties: string[] | null
          years_experience: number | null
          is_sample: boolean | null
          status: string
          weekly_schedule: Json | null
          avatar_url: string | null
        }[]
      }
      public_instructor: {
        Args: { p_id: string }
        Returns: {
          id: string
          user_id: string
          display_name: string
          bio: string | null
          specialties: string[] | null
          years_experience: number | null
          is_sample: boolean | null
          status: string
          weekly_schedule: Json | null
          avatar_url: string | null
        }[]
      }
      instructor_sessions: {
        Args: Record<string, never>
        Returns: {
          session_id: string
          session_number: number
          scheduled_at: string
          status: string
          meeting_url: string | null
          subscription_id: string
          participant_name: string
          package_name: string
          package_id: string
          user_ref: string
          child_ref: string | null
        }[]
      }
      my_dependent_link: {
        Args: Record<string, never>
        Returns: {
          child_profile_id: string
          guardian_profile_id: string
          full_name: string
        }[]
      }
      student_sessions: {
        Args: Record<string, never>
        Returns: {
          session_id: string
          session_number: number
          scheduled_at: string
          status: string
          meeting_url: string | null
          package_name: string
          instructor_name: string | null
        }[]
      }
      instructor_students: {
        Args: Record<string, never>
        Returns: {
          subscription_id: string
          user_ref: string
          child_ref: string | null
          /**
           * صاحب مستندات المعرض — ملف SQL 89.
           *
           * ⚠️ **مش** `user_ref`. حساب دخول الطفل لو موجود، وإلا
           *    المشتري. الفرق ده كان بيخلّي المدرب يسأل عن مستندات
           *    ولي الأمر بدل الطفل فيلاقيها فاضية.
           */
          documents_ref: string
          participant_name: string
          package_name: string
          sessions_total: number
          sessions_completed: number
          subscription_status: string
        }[]
      }
    }
    Enums: {
      age_group: "under_12" | "12_plus"
      booking_status_enum: "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled"
      commitment_type: "ongoing" | "fixed_term"
      compensation_approval_status: "proposed" | "under_discussion" | "approved" | "rejected"
      compensation_billing_model: "monthly" | "per_session"
      day_of_week: "saturday" | "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday"
      document_status_enum: "draft" | "submitted" | "reviewed"
      instructor_status_enum: "pending_training" | "pending_approval" | "active" | "suspended"
      join_request_status_enum: "pending" | "approved" | "rejected"
      order_status_enum: "pending" | "awaiting_verification" | "paid" | "failed" | "refunded" | "preparing" | "shipped" | "delivered" | "cancelled"
      owner_type: "platform" | "publisher"
      payout_status_enum: "pending" | "paid"
      product_category: "library" | "custom" | "subscription"
      provider_kind: "platform" | "instructor" | "individual"
      provider_status: "pending" | "active" | "suspended"
      publisher_status_enum: "pending" | "active" | "suspended"
      service_order_status: "pending" | "awaiting_verification" | "paid" | "refunded" | "in_progress" | "delivered" | "completed" | "cancelled"
      sub_status_enum: "active" | "cancelled" | "paused"
      support_session_status_enum: "pending" | "contacted" | "resolved"
      ticket_status_enum: "open" | "answered" | "closed"
      update_request_status: "pending" | "approved" | "rejected"
      user_role_enum: "visitor" | "customer" | "student" | "instructor" | "service_provider" | "publisher" | "general_supervisor" | "super_admin"
      work_model_enum: "per_session" | "monthly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
