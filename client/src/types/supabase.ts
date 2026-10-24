export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ad_clicks: {
        Row: {
          ad_id: string
          clicked_at: string
          id: string
          placement: string | null
        }
        Insert: {
          ad_id: string
          clicked_at?: string
          id?: string
          placement?: string | null
        }
        Update: {
          ad_id?: string
          clicked_at?: string
          id?: string
          placement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_clicks_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          advertiser_name: string | null
          created_at: string
          ends_at: string | null
          id: string
          image_url: string
          image_url_mobile: string | null
          is_active: boolean
          link_url: string | null
          placements: string[]
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          advertiser_name?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url: string
          image_url_mobile?: string | null
          is_active?: boolean
          link_url?: string | null
          placements?: string[]
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          advertiser_name?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string
          image_url_mobile?: string | null
          is_active?: boolean
          link_url?: string | null
          placements?: string[]
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          dial_code: string | null
          electronic_enabled: boolean
          is_default: boolean
          is_listed: boolean
          name_ar: string
          physical_enabled: boolean
          sort_order: number
          unavailable_message: string | null
          updated_at: string
        }
        Insert: {
          code: string
          dial_code?: string | null
          electronic_enabled?: boolean
          is_default?: boolean
          is_listed?: boolean
          name_ar: string
          physical_enabled?: boolean
          sort_order?: number
          unavailable_message?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          dial_code?: string | null
          electronic_enabled?: boolean
          is_default?: boolean
          is_listed?: boolean
          name_ar?: string
          physical_enabled?: boolean
          sort_order?: number
          unavailable_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      governorates: {
        Row: {
          country_code: string
          id: string
          is_active: boolean
          name_ar: string
          physical_enabled: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          country_code: string
          id?: string
          is_active?: boolean
          name_ar: string
          physical_enabled?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          physical_enabled?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governorates_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      price_promotions: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          is_active: boolean
          kind: string
          label: string | null
          starts_at: string
          target_id: string
          target_type: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          kind: string
          label?: string | null
          starts_at: string
          target_id: string
          target_type: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          label?: string | null
          starts_at?: string
          target_id?: string
          target_type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      writing_dialects: {
        Row: {
          code: string
          is_active: boolean
          name_ar: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          name_ar: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          name_ar?: string
          sort_order?: number
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      addon_products: {
        Row: {
          created_at: string
          customization_price: number
          description: string | null
          features: string[] | null
          gallery_image_urls: string[] | null
          id: string
          image_url: string | null
          is_active: boolean
          long_description: string | null
          name: string
          price: number
          slug: string
          sort_order: number
          supports_customization: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          customization_price?: number
          description?: string | null
          features?: string[] | null
          gallery_image_urls?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          long_description?: string | null
          name: string
          price?: number
          slug: string
          sort_order?: number
          supports_customization?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          customization_price?: number
          description?: string | null
          features?: string[] | null
          gallery_image_urls?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          long_description?: string | null
          name?: string
          price?: number
          slug?: string
          sort_order?: number
          supports_customization?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          permissions: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          permissions?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          permissions?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_challenges: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          is_active: boolean
          prompt: string
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          prompt: string
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          prompt?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_comments: {
        Row: {
          author_display_name: string
          author_id: string
          body: string
          created_at: string
          id: string
          is_instructor: boolean
          post_id: string
          removed_at: string | null
          status: string
        }
        Insert: {
          author_display_name: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_instructor?: boolean
          post_id: string
          removed_at?: string | null
          status?: string
        }
        Update: {
          author_display_name?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_instructor?: boolean
          post_id?: string
          removed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "aqlam_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_config: {
        Row: {
          id: boolean
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      aqlam_guardian_requests: {
        Row: {
          admin_note: string | null
          child_id: string
          child_name: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          guardian_id: string
          id: string
          kind: string
          reason: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          child_id: string
          child_name?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          guardian_id: string
          id?: string
          kind?: string
          reason: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          child_id?: string
          child_name?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          guardian_id?: string
          id?: string
          kind?: string
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_guardian_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_guardian_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_guardian_requests_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_guardian_settings: {
        Row: {
          child_id: string
          comments_allowed: boolean
          guardian_id: string
          publishing_allowed: boolean
          updated_at: string
        }
        Insert: {
          child_id: string
          comments_allowed?: boolean
          guardian_id: string
          publishing_allowed?: boolean
          updated_at?: string
        }
        Update: {
          child_id?: string
          comments_allowed?: boolean
          guardian_id?: string
          publishing_allowed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_guardian_settings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_guardian_settings_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_post_edits: {
        Row: {
          created_at: string
          id: string
          old_body: string
          old_title: string
          post_id: string
          writer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          old_body: string
          old_title: string
          post_id: string
          writer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          old_body?: string
          old_title?: string
          post_id?: string
          writer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_post_edits_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "aqlam_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_post_edits_writer_id_fkey"
            columns: ["writer_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_posts: {
        Row: {
          age_band: string | null
          age_group: string
          allow_indexing: boolean
          body: string
          category: string
          challenge_id: string | null
          comment_count: number
          comments_enabled: boolean
          consent_at: string
          consent_version: string
          created_at: string
          display_name: string
          edited_at: string | null
          featured_at: string | null
          featured_rank: number | null
          guardian_approved_at: string | null
          guardian_approved_by: string | null
          id: string
          name_mode: string
          published_at: string | null
          reaction_count: number
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          share_card_url: string | null
          source_document_id: string | null
          status: string
          title: string
          updated_at: string
          writer_id: string
        }
        Insert: {
          age_band?: string | null
          age_group: string
          allow_indexing?: boolean
          body: string
          category: string
          challenge_id?: string | null
          comment_count?: number
          comments_enabled?: boolean
          consent_at?: string
          consent_version: string
          created_at?: string
          display_name: string
          edited_at?: string | null
          featured_at?: string | null
          featured_rank?: number | null
          guardian_approved_at?: string | null
          guardian_approved_by?: string | null
          id?: string
          name_mode: string
          published_at?: string | null
          reaction_count?: number
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          share_card_url?: string | null
          source_document_id?: string | null
          status?: string
          title: string
          updated_at?: string
          writer_id: string
        }
        Update: {
          age_band?: string | null
          age_group?: string
          allow_indexing?: boolean
          body?: string
          category?: string
          challenge_id?: string | null
          comment_count?: number
          comments_enabled?: boolean
          consent_at?: string
          consent_version?: string
          created_at?: string
          display_name?: string
          edited_at?: string | null
          featured_at?: string | null
          featured_rank?: number | null
          guardian_approved_at?: string | null
          guardian_approved_by?: string | null
          id?: string
          name_mode?: string
          published_at?: string | null
          reaction_count?: number
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          share_card_url?: string | null
          source_document_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          writer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_posts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "aqlam_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_posts_guardian_approved_by_fkey"
            columns: ["guardian_approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_posts_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_posts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_posts_writer_id_fkey"
            columns: ["writer_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "aqlam_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_reports: {
        Row: {
          created_at: string
          details: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_sanctions: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          kind: string
          lifted_at: string | null
          lifted_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          lifted_at?: string | null
          lifted_by?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_sanctions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqlam_sanctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aqlam_writer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          pen_name: string | null
          public_profile: boolean
          public_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          pen_name?: string | null
          public_profile?: boolean
          public_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          pen_name?: string | null
          public_profile?: boolean
          public_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqlam_writer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_rules: {
        Row: {
          created_at: string
          line: string
          profile_id: string
          stage: string
        }
        Insert: {
          created_at?: string
          line: string
          profile_id: string
          stage: string
        }
        Update: {
          created_at?: string
          line?: string
          profile_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rules_profile_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string
          id: string
          is_draft: boolean
          published_at: string
          seo_description: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          content: string
          cover_image_url?: string | null
          created_at?: string
          excerpt: string
          id?: string
          is_draft?: boolean
          published_at?: string
          seo_description?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          is_draft?: boolean
          published_at?: string
          seo_description?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      box_shipments: {
        Row: {
          created_at: string
          delivered_at: string | null
          goal: string | null
          id: string
          month_number: number
          shipped_at: string | null
          status: string
          subscription_id: string
          tracking_reference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          goal?: string | null
          id?: string
          month_number: number
          shipped_at?: string | null
          status?: string
          subscription_id: string
          tracking_reference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          goal?: string | null
          id?: string
          month_number?: number
          shipped_at?: string | null
          status?: string
          subscription_id?: string
          tracking_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_shipments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "box_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      box_subscription_plans: {
        Row: {
          addon_discount_percent: number
          description: string | null
          duration_months: number
          features: string[]
          free_addon_id: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_highlighted: boolean
          name: string
          price_monthly: number
          price_total: number
          savings_note: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          addon_discount_percent?: number
          description?: string | null
          duration_months: number
          features?: string[]
          free_addon_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_highlighted?: boolean
          name: string
          price_monthly: number
          price_total: number
          savings_note?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          addon_discount_percent?: number
          description?: string | null
          duration_months?: number
          features?: string[]
          free_addon_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_highlighted?: boolean
          name?: string
          price_monthly?: number
          price_total?: number
          savings_note?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      box_subscriptions: {
        Row: {
          addon_discount_percent: number
          created_at: string
          customer_name: string
          details: Json | null
          ends_at: string | null
          free_addon_name: string | null
          id: string
          months: number | null
          next_shipment_date: string | null
          order_id: string | null
          plan_id: string | null
          plan_name: string
          starts_at: string | null
          status: Database["public"]["Enums"]["sub_status_enum"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          addon_discount_percent?: number
          created_at?: string
          customer_name: string
          details?: Json | null
          ends_at?: string | null
          free_addon_name?: string | null
          id?: string
          months?: number | null
          next_shipment_date?: string | null
          order_id?: string | null
          plan_id?: string | null
          plan_name: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["sub_status_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          addon_discount_percent?: number
          created_at?: string
          customer_name?: string
          details?: Json | null
          ends_at?: string | null
          free_addon_name?: string | null
          id?: string
          months?: number | null
          next_shipment_date?: string | null
          order_id?: string | null
          plan_id?: string | null
          plan_name?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["sub_status_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "box_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "box_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      child_profiles: {
        Row: {
          account_profile_id: string | null
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          full_name: string
          gender: string | null
          id: string
          user_profile_id: string
        }
        Insert: {
          account_profile_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          full_name: string
          gender?: string | null
          id?: string
          user_profile_id: string
        }
        Update: {
          account_profile_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_profiles_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_subscriptions: {
        Row: {
          paid_at: string | null
          payment_intent_id: string | null
          payment_provider: string
          payment_session_id: string | null
          amount: number | null
          child_id: string | null
          created_at: string
          discount_amount: number
          discount_code: string | null
          gift_message: string | null
          id: string
          package_id: string
          participant_type: string
          payment_method: string | null
          payment_receipt_url: string | null
          payment_reference: string | null
          preferred_instructor_id: string | null
          preferred_slot: Json | null
          recording_consent_at: string | null
          started_at: string | null
          status: string
          transaction_reference: string | null
          user_id: string
        }
        Insert: {
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          payment_session_id?: string | null
          amount?: number | null
          child_id?: string | null
          created_at?: string
          discount_amount?: number
          discount_code?: string | null
          gift_message?: string | null
          id?: string
          package_id: string
          participant_type: string
          payment_method?: string | null
          payment_receipt_url?: string | null
          payment_reference?: string | null
          preferred_instructor_id?: string | null
          preferred_slot?: Json | null
          recording_consent_at?: string | null
          started_at?: string | null
          status?: string
          transaction_reference?: string | null
          user_id: string
        }
        Update: {
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          payment_session_id?: string | null
          amount?: number | null
          child_id?: string | null
          created_at?: string
          discount_amount?: number
          discount_code?: string | null
          gift_message?: string | null
          id?: string
          package_id?: string
          participant_type?: string
          payment_method?: string | null
          payment_receipt_url?: string | null
          payment_reference?: string | null
          preferred_instructor_id?: string | null
          preferred_slot?: Json | null
          recording_consent_at?: string | null
          started_at?: string | null
          status?: string
          transaction_reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_subscriptions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "creative_writing_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_writing_packages: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"]
          created_at: string
          duration_text: string | null
          full_description: string | null
          id: string
          is_active: boolean
          name: string
          prerequisite_note: string | null
          prerequisite_package_id: string | null
          price: number
          session_duration: string | null
          sessions_count: number | null
          short_description: string | null
          slug: string
          target_audience: string | null
          track: string | null
          updated_at: string
        }
        Insert: {
          age_group: Database["public"]["Enums"]["age_group"]
          created_at?: string
          duration_text?: string | null
          full_description?: string | null
          id?: string
          is_active?: boolean
          name: string
          prerequisite_note?: string | null
          prerequisite_package_id?: string | null
          price: number
          session_duration?: string | null
          sessions_count?: number | null
          short_description?: string | null
          slug: string
          target_audience?: string | null
          track?: string | null
          updated_at?: string
        }
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"]
          created_at?: string
          duration_text?: string | null
          full_description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          prerequisite_note?: string | null
          prerequisite_package_id?: string | null
          price?: number
          session_duration?: string | null
          sessions_count?: number | null
          short_description?: string | null
          slug?: string
          target_audience?: string | null
          track?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_writing_packages_prerequisite_package_id_fkey"
            columns: ["prerequisite_package_id"]
            isOneToOne: false
            referencedRelation: "creative_writing_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_feedback: {
        Row: {
          admin_note: string | null
          comment: string | null
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          line: string
          rating: number
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          comment?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          line: string
          rating: number
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          comment?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          line?: string
          rating?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customization_fields: {
        Row: {
          applies_to: string[] | null
          created_at: string
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          placeholder: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          applies_to?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          applies_to?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      dependent_requests: {
        Row: {
          child_profile_id: string
          created_at: string
          decided_at: string | null
          guardian_note: string | null
          guardian_profile_id: string
          id: string
          instructor_id: string | null
          kind: string
          note: string | null
          package_id: string | null
          preferred_slot: Json | null
          product_id: string | null
          provider_id: string | null
          requested_name: string | null
          requester_profile_id: string | null
          service_id: string | null
          status: string
        }
        Insert: {
          child_profile_id: string
          created_at?: string
          decided_at?: string | null
          guardian_note?: string | null
          guardian_profile_id: string
          id?: string
          instructor_id?: string | null
          kind: string
          note?: string | null
          package_id?: string | null
          preferred_slot?: Json | null
          product_id?: string | null
          provider_id?: string | null
          requested_name?: string | null
          requester_profile_id?: string | null
          service_id?: string | null
          status?: string
        }
        Update: {
          child_profile_id?: string
          created_at?: string
          decided_at?: string | null
          guardian_note?: string | null
          guardian_profile_id?: string
          id?: string
          instructor_id?: string | null
          kind?: string
          note?: string | null
          package_id?: string | null
          preferred_slot?: Json | null
          product_id?: string | null
          provider_id?: string | null
          requested_name?: string | null
          requester_profile_id?: string | null
          service_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependent_requests_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependent_requests_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependent_requests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "creative_writing_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependent_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "personalized_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependent_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependent_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "standalone_services"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_code_uses: {
        Row: {
          code_id: string
          created_at: string
          discount_amount: number
          id: string
          line: string
          source_id: string
          user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string
          discount_amount: number
          id?: string
          line: string
          source_id: string
          user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          line?: string
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_uses_code_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          lines: string[] | null
          max_uses: number | null
          note: string | null
          percent: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          lines?: string[] | null
          max_uses?: number | null
          note?: string | null
          percent: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          lines?: string[] | null
          max_uses?: number | null
          note?: string | null
          percent?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      instructor_certifications: {
        Row: {
          certified_at: string | null
          exam_passed: boolean
          exam_score: number | null
          id: string
          instructor_id: string
          training_completed_at: string | null
          training_meeting_link: string | null
        }
        Insert: {
          certified_at?: string | null
          exam_passed?: boolean
          exam_score?: number | null
          id?: string
          instructor_id: string
          training_completed_at?: string | null
          training_meeting_link?: string | null
        }
        Update: {
          certified_at?: string | null
          exam_passed?: boolean
          exam_score?: number | null
          id?: string
          instructor_id?: string
          training_completed_at?: string | null
          training_meeting_link?: string | null
        }
        Relationships: []
      }
      instructor_media: {
        Row: {
          admin_feedback: string | null
          contribution: string | null
          created_at: string
          id: string
          image_url: string
          instructor_id: string
          kind: string
          sort_order: number
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          admin_feedback?: string | null
          contribution?: string | null
          created_at?: string
          id?: string
          image_url: string
          instructor_id: string
          kind: string
          sort_order?: number
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          admin_feedback?: string | null
          contribution?: string | null
          created_at?: string
          id?: string
          image_url?: string
          instructor_id?: string
          kind?: string
          sort_order?: number
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_media_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_packages: {
        Row: {
          created_at: string
          instructor_id: string
          package_id: string
        }
        Insert: {
          created_at?: string
          instructor_id: string
          package_id: string
        }
        Update: {
          created_at?: string
          instructor_id?: string
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_packages_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "creative_writing_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_payouts: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          instructor_id: string
          period: string
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["payout_status_enum"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          instructor_id: string
          period: string
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["payout_status_enum"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          instructor_id?: string
          period?: string
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["payout_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_payouts_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_pricing: {
        Row: {
          approved_price: number | null
          instructor_id: string
          monthly_hours_committed: number | null
          requested_price: number | null
          updated_at: string
        }
        Insert: {
          approved_price?: number | null
          instructor_id: string
          monthly_hours_committed?: number | null
          requested_price?: number | null
          updated_at?: string
        }
        Update: {
          approved_price?: number | null
          instructor_id?: string
          monthly_hours_committed?: number | null
          requested_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_pricing_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: true
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_pricing_options: {
        Row: {
          base_price_per_session: number
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          base_price_per_session: number
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          base_price_per_session?: number
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      instructors: {
        Row: {
          bio: string
          created_at: string
          display_name: string
          id: string
          is_sample: boolean | null
          pending_schedule: Json | null
          selected_pricing_option_id: string | null
          specialties: string[]
          status: Database["public"]["Enums"]["instructor_status_enum"]
          training_passed: boolean | null
          updated_at: string
          user_id: string
          weekly_schedule: Json | null
          work_model: Database["public"]["Enums"]["work_model_enum"]
          years_experience: number
        }
        Insert: {
          bio: string
          created_at?: string
          display_name: string
          id?: string
          is_sample?: boolean | null
          pending_schedule?: Json | null
          selected_pricing_option_id?: string | null
          specialties: string[]
          status?: Database["public"]["Enums"]["instructor_status_enum"]
          training_passed?: boolean | null
          updated_at?: string
          user_id: string
          weekly_schedule?: Json | null
          work_model?: Database["public"]["Enums"]["work_model_enum"]
          years_experience: number
        }
        Update: {
          bio?: string
          created_at?: string
          display_name?: string
          id?: string
          is_sample?: boolean | null
          pending_schedule?: Json | null
          selected_pricing_option_id?: string | null
          specialties?: string[]
          status?: Database["public"]["Enums"]["instructor_status_enum"]
          training_passed?: boolean | null
          updated_at?: string
          user_id?: string
          weekly_schedule?: Json | null
          work_model?: Database["public"]["Enums"]["work_model_enum"]
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "instructors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      join_request_messages: {
        Row: {
          author: string
          author_profile_id: string | null
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author: string
          author_profile_id?: string | null
          body: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author?: string
          author_profile_id?: string | null
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: []
      }
      join_requests: {
        Row: {
          access_token: string
          applicant_name: string
          created_at: string
          email: string | null
          id: string
          message: string | null
          phone: string | null
          portfolio_url: string | null
          requested_role: string
          status: Database["public"]["Enums"]["join_request_status_enum"]
          updated_at: string
        }
        Insert: {
          access_token?: string
          applicant_name: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          portfolio_url?: string | null
          requested_role: string
          status?: Database["public"]["Enums"]["join_request_status_enum"]
          updated_at?: string
        }
        Update: {
          access_token?: string
          applicant_name?: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          portfolio_url?: string | null
          requested_role?: string
          status?: Database["public"]["Enums"]["join_request_status_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          recipient_profile_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          recipient_profile_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          recipient_profile_id?: string
          title?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          customization_data: Json | null
          format: string
          id: string
          list_price_snapshot: number | null
          order_id: string
          product_id: string
          publisher_cost_snapshot: number | null
          publisher_id_snapshot: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          customization_data?: Json | null
          format?: string
          id?: string
          list_price_snapshot?: number | null
          order_id: string
          product_id: string
          publisher_cost_snapshot?: number | null
          publisher_id_snapshot?: string | null
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          customization_data?: Json | null
          format?: string
          id?: string
          list_price_snapshot?: number | null
          order_id?: string
          product_id?: string
          publisher_cost_snapshot?: number | null
          publisher_id_snapshot?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_line: string | null
          admin_notes: string | null
          box_details: Json | null
          box_plan_id: string | null
          city: string | null
          country_code: string
          created_at: string
          delivered_at: string | null
          delivery_email: string | null
          dependent_participant_id: string | null
          discount_amount: number
          discount_code: string | null
          electronic_sent_at: string | null
          governorate: string | null
          id: string
          independent_participant_id: string | null
          payment_method: string | null
          paid_at: string | null
          payment_intent_id: string | null
          payment_provider: string
          payment_session_id: string | null
          payment_receipt_url: string | null
          payment_reference: string | null
          recipient_name: string | null
          recipient_phone: string | null
          shipped_at: string | null
          shipping_fee: number
          shipping_notes: string | null
          status: Database["public"]["Enums"]["order_status_enum"]
          total_amount: number
          tracking_reference: string | null
          transaction_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line?: string | null
          admin_notes?: string | null
          box_details?: Json | null
          box_plan_id?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          delivered_at?: string | null
          delivery_email?: string | null
          dependent_participant_id?: string | null
          discount_amount?: number
          discount_code?: string | null
          electronic_sent_at?: string | null
          governorate?: string | null
          id?: string
          independent_participant_id?: string | null
          payment_method?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          payment_session_id?: string | null
          payment_receipt_url?: string | null
          payment_reference?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          shipped_at?: string | null
          shipping_fee?: number
          shipping_notes?: string | null
          status?: Database["public"]["Enums"]["order_status_enum"]
          total_amount: number
          tracking_reference?: string | null
          transaction_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string | null
          admin_notes?: string | null
          box_details?: Json | null
          box_plan_id?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          delivered_at?: string | null
          delivery_email?: string | null
          dependent_participant_id?: string | null
          discount_amount?: number
          discount_code?: string | null
          electronic_sent_at?: string | null
          governorate?: string | null
          id?: string
          independent_participant_id?: string | null
          payment_method?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          payment_session_id?: string | null
          payment_receipt_url?: string | null
          payment_reference?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          shipped_at?: string | null
          shipping_fee?: number
          shipping_notes?: string | null
          status?: Database["public"]["Enums"]["order_status_enum"]
          total_amount?: number
          tracking_reference?: string | null
          transaction_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      page_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          source_id: string | null
          source_kind: string
          amount_minor: number | null
          created_at: string
          event_type: string
          id: string
          order_id: string | null
          outcome: string
          payload: Json | null
        }
        Insert: {
          source_id?: string | null
          source_kind?: string
          amount_minor?: number | null
          created_at?: string
          event_type: string
          id: string
          order_id?: string | null
          outcome: string
          payload?: Json | null
        }
        Update: {
          source_id?: string | null
          source_kind?: string
          amount_minor?: number | null
          created_at?: string
          event_type?: string
          id?: string
          order_id?: string | null
          outcome?: string
          payload?: Json | null
        }
        Relationships: []
      }
      personalized_products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          cover_image_url: string | null
          created_at: string
          electronic_price: number | null
          features: string[] | null
          gallery_image_urls: string[] | null
          id: string
          is_active: boolean
          long_description: string | null
          max_age: number | null
          min_age: number | null
          name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          pending_changes: Json | null
          previous_slugs: string[]
          price: number
          publisher_cost: number | null
          publisher_id: string | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          short_description: string | null
          slug: string
          sort_order: number
          updated_at: string
          writing_styles: string[] | null
          delivery_days_electronic: number | null
          delivery_days_printed: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          cover_image_url?: string | null
          created_at?: string
          electronic_price?: number | null
          features?: string[] | null
          gallery_image_urls?: string[] | null
          id?: string
          is_active?: boolean
          long_description?: string | null
          max_age?: number | null
          min_age?: number | null
          name: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          pending_changes?: Json | null
          previous_slugs?: string[]
          price: number
          publisher_cost?: number | null
          publisher_id?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          writing_styles?: string[] | null
          delivery_days_electronic?: number | null
          delivery_days_printed?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          cover_image_url?: string | null
          created_at?: string
          electronic_price?: number | null
          features?: string[] | null
          gallery_image_urls?: string[] | null
          id?: string
          is_active?: boolean
          long_description?: string | null
          max_age?: number | null
          min_age?: number | null
          name?: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          pending_changes?: Json | null
          previous_slugs?: string[]
          price?: number
          publisher_cost?: number | null
          publisher_id?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          writing_styles?: string[] | null
          delivery_days_electronic?: number | null
          delivery_days_printed?: number | null
        }
        Relationships: []
      }
      portfolio_documents: {
        Row: {
          content: string
          created_at: string
          id: string
          instructor_feedback: string | null
          status: Database["public"]["Enums"]["document_status_enum"]
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          instructor_feedback?: string | null
          status?: Database["public"]["Enums"]["document_status_enum"]
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          instructor_feedback?: string | null
          status?: Database["public"]["Enums"]["document_status_enum"]
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_formula_settings: {
        Row: {
          fixed_admin_fee: number
          id: string
          platform_multiplier: number
          updated_at: string
        }
        Insert: {
          fixed_admin_fee?: number
          id?: string
          platform_multiplier?: number
          updated_at?: string
        }
        Update: {
          fixed_admin_fee?: number
          id?: string
          platform_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      private_file_cleanup_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          deletion_reason: string
          file_id: string | null
          id: string
          intent_id: string | null
          last_attempt_at: string | null
          last_error: string | null
          lease_token: string | null
          lease_until: string | null
          provider: string
          provider_locator: Json
          state: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          deletion_reason: string
          file_id?: string | null
          id?: string
          intent_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          provider?: string
          provider_locator: Json
          state?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          deletion_reason?: string
          file_id?: string | null
          id?: string
          intent_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          provider?: string
          provider_locator?: Json
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_file_cleanup_jobs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "private_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_file_cleanup_jobs_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "private_file_upload_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      private_file_upload_intents: {
        Row: {
          created_at: string
          expected_bytes: number
          expires_at: string
          file_ext: string
          file_name: string
          finalized_at: string | null
          id: string
          last_error: string | null
          lifecycle_state: string
          max_bytes: number
          owner_id: string
          owner_kind: string
          provider: string
          provider_locator: Json
          reconciled_at: string | null
          resource_type: string
          signing_expires_at: string
          uploader_profile_id: string
        }
        Insert: {
          created_at?: string
          expected_bytes: number
          expires_at: string
          file_ext: string
          file_name: string
          finalized_at?: string | null
          id?: string
          last_error?: string | null
          lifecycle_state?: string
          max_bytes: number
          owner_id: string
          owner_kind: string
          provider?: string
          provider_locator: Json
          reconciled_at?: string | null
          resource_type: string
          signing_expires_at: string
          uploader_profile_id: string
        }
        Update: {
          created_at?: string
          expected_bytes?: number
          expires_at?: string
          file_ext?: string
          file_name?: string
          finalized_at?: string | null
          id?: string
          last_error?: string | null
          lifecycle_state?: string
          max_bytes?: number
          owner_id?: string
          owner_kind?: string
          provider?: string
          provider_locator?: Json
          reconciled_at?: string | null
          resource_type?: string
          signing_expires_at?: string
          uploader_profile_id?: string
        }
        Relationships: []
      }
      private_files: {
        Row: {
          bytes: number
          created_at: string
          deleted_at: string | null
          deletion_reason: string | null
          document_id: string | null
          file_name: string
          format: string | null
          id: string
          is_delivery: boolean
          lifecycle_state: string
          order_id: string | null
          public_id: string
          resource_type: string
          upload_intent_id: string | null
          uploader_profile_id: string
        }
        Insert: {
          bytes: number
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          document_id?: string | null
          file_name: string
          format?: string | null
          id?: string
          is_delivery?: boolean
          lifecycle_state?: string
          order_id?: string | null
          public_id: string
          resource_type: string
          upload_intent_id?: string | null
          uploader_profile_id: string
        }
        Update: {
          bytes?: number
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          document_id?: string | null
          file_name?: string
          format?: string | null
          id?: string
          is_delivery?: boolean
          lifecycle_state?: string
          order_id?: string | null
          public_id?: string
          resource_type?: string
          upload_intent_id?: string | null
          uploader_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "portfolio_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_files_upload_intent_fk"
            columns: ["upload_intent_id"]
            isOneToOne: false
            referencedRelation: "private_file_upload_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_update_requests: {
        Row: {
          admin_feedback: string | null
          created_at: string
          id: string
          instructor_id: string
          requested_changes: Json
          status: Database["public"]["Enums"]["update_request_status"]
        }
        Insert: {
          admin_feedback?: string | null
          created_at?: string
          id?: string
          instructor_id: string
          requested_changes: Json
          status?: Database["public"]["Enums"]["update_request_status"]
        }
        Update: {
          admin_feedback?: string | null
          created_at?: string
          id?: string
          instructor_id?: string
          requested_changes?: Json
          status?: Database["public"]["Enums"]["update_request_status"]
        }
        Relationships: []
      }
      provider_services: {
        Row: {
          admin_notes: string | null
          approved_price: number | null
          created_at: string
          id: string
          is_active: boolean
          provider_id: string
          requested_price: number | null
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider_id: string
          requested_price?: number | null
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider_id?: string
          requested_price?: number | null
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "standalone_services"
            referencedColumns: ["id"]
          },
        ]
      }
      publisher_payouts: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          period: string
          publisher_id: string
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["payout_status_enum"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          period: string
          publisher_id: string
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["payout_status_enum"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          period?: string
          publisher_id?: string
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["payout_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publisher_payouts_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      publishers: {
        Row: {
          bio: string
          created_at: string
          id: string
          is_sample: boolean | null
          logo_url: string | null
          name: string
          slug: string
          status: Database["public"]["Enums"]["publisher_status_enum"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio: string
          created_at?: string
          id?: string
          is_sample?: boolean | null
          logo_url?: string | null
          name: string
          slug: string
          status?: Database["public"]["Enums"]["publisher_status_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string
          created_at?: string
          id?: string
          is_sample?: boolean | null
          logo_url?: string | null
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["publisher_status_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publishers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string
          dependent_participant_id: string | null
          hidden_reason: string | null
          id: string
          independent_participant_id: string | null
          instructor_id: string
          is_hidden: boolean
          rating: number
          reviewer_profile_id: string | null
          service_order_id: string | null
          service_rating: number | null
          standalone_service_id: string | null
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          dependent_participant_id?: string | null
          hidden_reason?: string | null
          id?: string
          independent_participant_id?: string | null
          instructor_id: string
          is_hidden?: boolean
          rating: number
          reviewer_profile_id?: string | null
          service_order_id?: string | null
          service_rating?: number | null
          standalone_service_id?: string | null
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          dependent_participant_id?: string | null
          hidden_reason?: string | null
          id?: string
          independent_participant_id?: string | null
          instructor_id?: string
          is_hidden?: boolean
          rating?: number
          reviewer_profile_id?: string | null
          service_order_id?: string | null
          service_rating?: number | null
          standalone_service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_dependent_participant_id_fkey"
            columns: ["dependent_participant_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_delivery: boolean
          order_id: string
          sender_profile_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_delivery?: boolean
          order_id: string
          sender_profile_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_delivery?: boolean
          order_id?: string
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          paid_at: string | null
          payment_intent_id: string | null
          payment_provider: string
          payment_session_id: string | null
          amount: number
          buyer_profile_id: string
          child_id: string | null
          completed_at: string | null
          created_at: string
          delivered_at: string | null
          discount_amount: number
          discount_code: string | null
          due_at: string | null
          due_note: string | null
          due_overdue_notified_at: string | null
          due_warned_at: string | null
          id: string
          instructor_earning: number | null
          instructor_id: string | null
          package_id: string | null
          participant_type: string
          payment_method: string | null
          payment_receipt_url: string | null
          payment_reference: string | null
          provider_id: string | null
          standalone_service_id: string | null
          status: Database["public"]["Enums"]["service_order_status"]
          transaction_reference: string | null
        }
        Insert: {
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          payment_session_id?: string | null
          amount: number
          buyer_profile_id: string
          child_id?: string | null
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          discount_amount?: number
          discount_code?: string | null
          due_at?: string | null
          due_note?: string | null
          due_overdue_notified_at?: string | null
          due_warned_at?: string | null
          id?: string
          instructor_earning?: number | null
          instructor_id?: string | null
          package_id?: string | null
          participant_type?: string
          payment_method?: string | null
          payment_receipt_url?: string | null
          payment_reference?: string | null
          provider_id?: string | null
          standalone_service_id?: string | null
          status?: Database["public"]["Enums"]["service_order_status"]
          transaction_reference?: string | null
        }
        Update: {
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          payment_session_id?: string | null
          amount?: number
          buyer_profile_id?: string
          child_id?: string | null
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          discount_amount?: number
          discount_code?: string | null
          due_at?: string | null
          due_note?: string | null
          due_overdue_notified_at?: string | null
          due_warned_at?: string | null
          id?: string
          instructor_earning?: number | null
          instructor_id?: string | null
          package_id?: string | null
          participant_type?: string
          payment_method?: string | null
          payment_receipt_url?: string | null
          payment_reference?: string | null
          provider_id?: string | null
          standalone_service_id?: string | null
          status?: Database["public"]["Enums"]["service_order_status"]
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "creative_writing_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_standalone_service_id_fkey"
            columns: ["standalone_service_id"]
            isOneToOne: false
            referencedRelation: "standalone_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          avatar_url: string | null
          bio: string
          created_at: string
          display_name: string
          id: string
          instructor_id: string | null
          is_public: boolean
          kind: Database["public"]["Enums"]["provider_kind"]
          status: Database["public"]["Enums"]["provider_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          display_name: string
          id?: string
          instructor_id?: string | null
          is_public?: boolean
          kind: Database["public"]["Enums"]["provider_kind"]
          status?: Database["public"]["Enums"]["provider_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          id?: string
          instructor_id?: string | null
          is_public?: boolean
          kind?: Database["public"]["Enums"]["provider_kind"]
          status?: Database["public"]["Enums"]["provider_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attachments: {
        Row: {
          booking_id: string
          file_name: string
          file_url: string
          id: string
        }
        Insert: {
          booking_id: string
          file_name: string
          file_url: string
          id?: string
        }
        Update: {
          booking_id?: string
          file_name?: string
          file_url?: string
          id?: string
        }
        Relationships: []
      }
      session_change_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          proposed_at: string
          reason: string
          requester_profile_id: string
          requester_role: string
          session_id: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          proposed_at: string
          reason: string
          requester_profile_id: string
          requester_role: string
          session_id: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          proposed_at?: string
          reason?: string
          requester_profile_id?: string
          requester_role?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_change_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_messages: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          message: string
          sender_profile_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          message: string
          sender_profile_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          message?: string
          sender_profile_id?: string
        }
        Relationships: []
      }
      session_reports: {
        Row: {
          attendance: string
          created_at: string
          id: string
          instructor_id: string
          report: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          attendance: string
          created_at?: string
          id?: string
          instructor_id: string
          report?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          attendance?: string
          created_at?: string
          id?: string
          instructor_id?: string
          report?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_reports_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          course_subscription_id: string
          created_at: string
          id: string
          instructor_id: string | null
          meeting_url: string | null
          recording_expires_at: string | null
          recording_id: string | null
          recording_status: string | null
          room_name: string | null
          room_url: string | null
          scheduled_at: string
          session_number: number
          status: string
          updated_at: string | null
        }
        Insert: {
          course_subscription_id: string
          created_at?: string
          id?: string
          instructor_id?: string | null
          meeting_url?: string | null
          recording_expires_at?: string | null
          recording_id?: string | null
          recording_status?: string | null
          room_name?: string | null
          room_url?: string | null
          scheduled_at: string
          session_number: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          course_subscription_id?: string
          created_at?: string
          id?: string
          instructor_id?: string | null
          meeting_url?: string | null
          recording_expires_at?: string | null
          recording_id?: string | null
          recording_status?: string | null
          room_name?: string | null
          room_url?: string | null
          scheduled_at?: string
          session_number?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_course_subscription_id_fkey"
            columns: ["course_subscription_id"]
            isOneToOne: false
            referencedRelation: "course_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          city: string | null
          country_code: string
          eta_days_max: number | null
          eta_days_min: number | null
          fee: number
          governorate: string
          id: string
          is_active: boolean
          is_estimate: boolean
          updated_at: string
        }
        Insert: {
          city?: string | null
          country_code?: string
          eta_days_max?: number | null
          eta_days_min?: number | null
          fee: number
          governorate: string
          id?: string
          is_active?: boolean
          is_estimate?: boolean
          updated_at?: string
        }
        Update: {
          city?: string | null
          country_code?: string
          eta_days_max?: number | null
          eta_days_min?: number | null
          fee?: number
          governorate?: string
          id?: string
          is_active?: boolean
          is_estimate?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "shipping_rates_governorate_fk"
            columns: ["country_code", "governorate"]
            isOneToOne: false
            referencedRelation: "governorates"
            referencedColumns: ["country_code", "name_ar"]
          },
        ]
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
      stale_order_notification_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          last_attempt_at: string | null
          last_error: string | null
          link: string
          message: string
          order_id: string
          recipient_profile_id: string
          title: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          link: string
          message: string
          order_id: string
          recipient_profile_id: string
          title: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          link?: string
          message?: string
          order_id?: string
          recipient_profile_id?: string
          title?: string
        }
        Relationships: []
      }
      standalone_services: {
        Row: {
          allows_files: boolean
          category: string | null
          cover_image_url: string | null
          deliverables: string[] | null
          delivery_days: number | null
          description: string | null
          file_kinds: string[]
          file_max_mb: number
          gallery_image_urls: string[] | null
          id: string
          is_active: boolean
          long_description: string | null
          name: string
          price: number
          price_type: string
          requirements: string | null
          sort_order: number | null
        }
        Insert: {
          allows_files?: boolean
          category?: string | null
          cover_image_url?: string | null
          deliverables?: string[] | null
          delivery_days?: number | null
          description?: string | null
          file_kinds?: string[]
          file_max_mb?: number
          gallery_image_urls?: string[] | null
          id?: string
          is_active?: boolean
          long_description?: string | null
          name: string
          price: number
          price_type?: string
          requirements?: string | null
          sort_order?: number | null
        }
        Update: {
          allows_files?: boolean
          category?: string | null
          cover_image_url?: string | null
          deliverables?: string[] | null
          delivery_days?: number | null
          description?: string | null
          file_kinds?: string[]
          file_max_mb?: number
          gallery_image_urls?: string[] | null
          id?: string
          is_active?: boolean
          long_description?: string | null
          name?: string
          price?: number
          price_type?: string
          requirements?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      story_cost_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          minutes: number | null
          note: string | null
          project_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          minutes?: number | null
          note?: string | null
          project_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          minutes?: number | null
          note?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_cost_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_cost_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "story_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      story_goals: {
        Row: {
          applies_to: string[] | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          applies_to?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          applies_to?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      story_pages: {
        Row: {
          attempts: number
          id: string
          image_url: string | null
          page_no: number
          page_text: string
          project_id: string
          reviewer_note: string | null
          scene_description: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          id?: string
          image_url?: string | null
          page_no: number
          page_text?: string
          project_id: string
          reviewer_note?: string | null
          scene_description?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          id?: string
          image_url?: string | null
          page_no?: number
          page_text?: string
          project_id?: string
          reviewer_note?: string | null
          scene_description?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "story_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      story_projects: {
        Row: {
          age_band: string | null
          art_lead_id: string | null
          brief: Json
          character_approved_at: string | null
          character_approved_by: string | null
          character_notes: string | null
          character_ref_url: string | null
          created_at: string
          delivered_at: string | null
          delivery_note: string | null
          due_at: string | null
          editor_id: string | null
          face_mode: string
          held_from: string | null
          id: string
          order_id: string
          order_closed_at: string | null
          order_item_id: string
          page_target: number | null
          photo_consent_at: string | null
          photo_consent_by: string | null
          photo_consent_note: string | null
          product_id: string
          qa_checklist: Json
          qa_passed_at: string | null
          qa_passed_by: string | null
          sensitive_topic: boolean
          status: string
          updated_at: string
        }
        Insert: {
          age_band?: string | null
          art_lead_id?: string | null
          brief?: Json
          character_approved_at?: string | null
          character_approved_by?: string | null
          character_notes?: string | null
          character_ref_url?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_note?: string | null
          due_at?: string | null
          editor_id?: string | null
          face_mode?: string
          held_from?: string | null
          id?: string
          order_closed_at?: string | null
          order_id: string
          order_item_id: string
          page_target?: number | null
          photo_consent_at?: string | null
          photo_consent_by?: string | null
          photo_consent_note?: string | null
          product_id: string
          qa_checklist?: Json
          qa_passed_at?: string | null
          qa_passed_by?: string | null
          sensitive_topic?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          age_band?: string | null
          art_lead_id?: string | null
          brief?: Json
          character_approved_at?: string | null
          character_approved_by?: string | null
          character_notes?: string | null
          character_ref_url?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_note?: string | null
          due_at?: string | null
          editor_id?: string | null
          face_mode?: string
          held_from?: string | null
          id?: string
          order_closed_at?: string | null
          order_id?: string
          order_item_id?: string
          page_target?: number | null
          photo_consent_at?: string | null
          photo_consent_by?: string | null
          photo_consent_note?: string | null
          product_id?: string
          qa_checklist?: Json
          qa_passed_at?: string | null
          qa_passed_by?: string | null
          sensitive_topic?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_projects_art_lead_id_fkey"
            columns: ["art_lead_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_projects_character_approved_by_fkey"
            columns: ["character_approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_projects_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_projects_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_projects_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_projects_photo_consent_by_fkey"
            columns: ["photo_consent_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_projects_qa_passed_by_fkey"
            columns: ["qa_passed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_courses: {
        Row: {
          id: string
          title: string
          version: string
          content: Json
          module_pass_pct: number
          final_pass_pct: number
          critical_required: boolean
          required_for_activation: boolean
          is_active: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id: string
          title: string
          version: string
          content: Json
          module_pass_pct?: number
          final_pass_pct?: number
          critical_required?: boolean
          required_for_activation?: boolean
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          title?: string
          version?: string
          content?: Json
          module_pass_pct?: number
          final_pass_pct?: number
          critical_required?: boolean
          required_for_activation?: boolean
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      training_final_attempts: {
        Row: {
          id: string
          user_id: string
          course_id: string
          course_version: string
          selected: Json
          correct: number
          total: number
          score: number
          critical_correct: number
          critical_total: number
          passed: boolean
          submitted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          course_version: string
          selected: Json
          correct: number
          total: number
          score: number
          critical_correct: number
          critical_total: number
          passed: boolean
          submitted_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          course_version?: string
          selected?: Json
          correct?: number
          total?: number
          score?: number
          critical_correct?: number
          critical_total?: number
          passed?: boolean
          submitted_at?: string
        }
        Relationships: []
      }
      training_progress: {
        Row: {
          user_id: string
          course_id: string
          started_at: string
          last_seen_at: string
          active_seconds: number
          modules: Json
          final_attempts: number
          best_score: number | null
          passed_at: string | null
          passed_version: string | null
          reset_at: string | null
        }
        Insert: {
          user_id: string
          course_id: string
          started_at?: string
          last_seen_at?: string
          active_seconds?: number
          modules?: Json
          final_attempts?: number
          best_score?: number | null
          passed_at?: string | null
          passed_version?: string | null
          reset_at?: string | null
        }
        Update: {
          user_id?: string
          course_id?: string
          started_at?: string
          last_seen_at?: string
          active_seconds?: number
          modules?: Json
          final_attempts?: number
          best_score?: number | null
          passed_at?: string | null
          passed_version?: string | null
          reset_at?: string | null
        }
        Relationships: []
      }
      story_image_reviews: {
        Row: {
          id: string
          project_id: string
          image_url: string
          staff_note: string | null
          status: string
          sent_at: string
          sent_by: string | null
          decided_at: string | null
          decided_by: string | null
          client_note: string | null
        }
        Insert: {
          id?: string
          project_id: string
          image_url: string
          staff_note?: string | null
          status?: string
          sent_at?: string
          sent_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          client_note?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          image_url?: string
          staff_note?: string | null
          status?: string
          sent_at?: string
          sent_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          client_note?: string | null
        }
        Relationships: []
      }
      story_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          client_decision_at: string | null
          client_decision_note: string | null
          client_decision_by: string | null
          sent_to_client_at: string | null
          sent_to_client_by: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          project_id: string
          source: string
          status: string
          version_no: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          client_decision_at?: string | null
          client_decision_note?: string | null
          client_decision_by?: string | null
          sent_to_client_at?: string | null
          sent_to_client_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          project_id: string
          source?: string
          status?: string
          version_no: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          client_decision_at?: string | null
          client_decision_note?: string | null
          client_decision_by?: string | null
          sent_to_client_at?: string | null
          sent_to_client_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          project_id?: string
          source?: string
          status?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "story_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "story_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_materials: {
        Row: {
          description: string | null
          id: string
          package_id: string | null
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          package_id?: string | null
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          package_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_materials_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "creative_writing_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      support_session_requests: {
        Row: {
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          message: string
          status: Database["public"]["Enums"]["support_session_status_enum"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          contact_name: string
          contact_phone: string
          created_at?: string
          id?: string
          message: string
          status?: Database["public"]["Enums"]["support_session_status_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["support_session_status_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_session_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_profile_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_profile_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_profile_id?: string
          ticket_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          requester_name: string
          status: Database["public"]["Enums"]["ticket_status_enum"]
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          requester_name: string
          status?: Database["public"]["Enums"]["ticket_status_enum"]
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          requester_name?: string
          status?: Database["public"]["Enums"]["ticket_status_enum"]
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author_name: string
          author_role: string
          content: string
          line: string
          created_at: string
          id: string
        }
        Insert: {
          author_name: string
          author_role: string
          content: string
          line?: string
          created_at?: string
          id?: string
        }
        Update: {
          author_name?: string
          author_role?: string
          content?: string
          line?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_emails: {
        Row: {
          email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          admin_role_id: string | null
          archived_at: string | null
          archived_by: string | null
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_guardian: boolean | null
          role: Database["public"]["Enums"]["user_role_enum"]
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          admin_role_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          is_guardian?: boolean | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          admin_role_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_guardian?: boolean | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_admin_role_id_fkey"
            columns: ["admin_role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          owner_id: string
          owner_kind: string
          period: string
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["payout_status_enum"]
          updated_at: string
          withdrawal_request_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          owner_kind: string
          period: string
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["payout_status_enum"]
          updated_at?: string
          withdrawal_request_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          owner_kind?: string
          period?: string
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["payout_status_enum"]
          updated_at?: string
          withdrawal_request_id?: string | null
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          instructor_id: string | null
          method: string
          payout_details: string | null
          provider_id: string | null
          publisher_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          instructor_id?: string | null
          method: string
          payout_details?: string | null
          provider_id?: string | null
          publisher_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          instructor_id?: string | null
          method?: string
          payout_details?: string | null
          provider_id?: string | null
          publisher_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      task_steps: {
        Row: {
          abilities: string[]
          active: boolean
          advance_by: string
          optional: boolean
          builtin: boolean
          gates: string[]
          hint: string | null
          kind: string
          label: string
          line: string
          owner_kind: string
          show_tab: boolean
          sla_hours: number | null
          sort_order: number
          step: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          abilities?: string[]
          active?: boolean
          advance_by?: string
          optional?: boolean
          builtin?: boolean
          gates?: string[]
          hint?: string | null
          kind?: string
          label: string
          line: string
          owner_kind?: string
          show_tab?: boolean
          sla_hours?: number | null
          sort_order?: number
          step: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          abilities?: string[]
          active?: boolean
          advance_by?: string
          optional?: boolean
          builtin?: boolean
          gates?: string[]
          hint?: string | null
          kind?: string
          label?: string
          line?: string
          owner_kind?: string
          show_tab?: boolean
          sla_hours?: number | null
          sort_order?: number
          step?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      task_edges: {
        Row: {
          created_at: string
          from_step: string
          line: string
          pages_redo: boolean
          reset_qa: boolean
          skip_gates: boolean
          to_step: string
          who: string
        }
        Insert: {
          created_at?: string
          from_step: string
          line?: string
          pages_redo?: boolean
          reset_qa?: boolean
          skip_gates?: boolean
          to_step: string
          who?: string
        }
        Update: {
          created_at?: string
          from_step?: string
          line?: string
          pages_redo?: boolean
          reset_qa?: boolean
          skip_gates?: boolean
          to_step?: string
          who?: string
        }
        Relationships: []
      }
      studio_product_routes: {
        Row: {
          gates_off: string[]
          line: string
          product_id: string
          state: string
          step: string
          updated_at: string
        }
        Insert: {
          gates_off?: string[]
          line?: string
          product_id: string
          state?: string
          step: string
          updated_at?: string
        }
        Update: {
          gates_off?: string[]
          line?: string
          product_id?: string
          state?: string
          step?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_task_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_value: string | null
          id: number
          kind: string
          note: string | null
          task_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: number
          kind: string
          note?: string | null
          task_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: number
          kind?: string
          note?: string | null
          task_id?: string
          to_value?: string | null
        }
        Relationships: []
      }
      work_tasks: {
        Row: {
          assignee_ids: string[]
          created_at: string
          done_at: string | null
          done_by: string | null
          due_at: string | null
          overdue_notified_at: string | null
          priority: string
          soon_notified_at: string | null
          step: string
          step_changed_at: string
          id: string
          line: string
          link: string
          reference: string | null
          source_id: string
          stage: string
          status: string
          title: string
        }
        Insert: {
          assignee_ids?: string[]
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          due_at?: string | null
          overdue_notified_at?: string | null
          priority?: string
          soon_notified_at?: string | null
          step?: string
          step_changed_at?: string
          id?: string
          line: string
          link: string
          reference?: string | null
          source_id: string
          stage: string
          status?: string
          title: string
        }
        Update: {
          assignee_ids?: string[]
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          due_at?: string | null
          overdue_notified_at?: string | null
          priority?: string
          soon_notified_at?: string | null
          step?: string
          step_changed_at?: string
          id?: string
          line?: string
          link?: string
          reference?: string | null
          source_id?: string
          stage?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      aqlam_public_comments: {
        Row: {
          author_display_name: string | null
          body: string | null
          created_at: string | null
          id: string | null
          is_instructor: boolean | null
          post_id: string | null
        }
        Relationships: []
      }
      aqlam_public_posts: {
        Row: {
          age_band: string | null
          age_group: string | null
          allow_indexing: boolean | null
          body: string | null
          category: string | null
          challenge_id: string | null
          comment_count: number | null
          comments_enabled: boolean | null
          display_name: string | null
          edited_at: string | null
          excerpt: string | null
          featured_at: string | null
          featured_rank: number | null
          id: string | null
          published_at: string | null
          reaction_count: number | null
          share_card_url: string | null
          title: string | null
          writer_slug: string | null
        }
        Relationships: []
      }
      aqlam_public_writers: {
        Row: {
          age_band: string | null
          bio: string | null
          name: string | null
          posts_count: number | null
          slug: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ad_click_counts: {
        Args: never
        Returns: {
          ad_id: string
          clicks: number
        }[]
      }
      admin_has_permission: { Args: { p_permission: string }; Returns: boolean }
      aqlam_admin_config: {
        Args: never
        Returns: Json
      }
      aqlam_admin_find_users: {
        Args: { p_ids?: string[]; p_query?: string }
        Returns: Json
      }
      aqlam_lift_sanction: {
        Args: { p_sanction: string }
        Returns: Json
      }
      aqlam_set_writer_profile: {
        Args: { p_bio: string | null; p_pen_name: string | null; p_public: boolean }
        Returns: Json
      }
      aqlam_update_post: {
        Args: {
          p_allow_indexing: boolean
          p_body: string
          p_category: string
          p_comments_enabled: boolean
          p_post: string
          p_title: string
        }
        Returns: Json
      }
      aqlam_add_comment: {
        Args: { p_body: string; p_post: string }
        Returns: Json
      }
      aqlam_cancel_guardian_request: {
        Args: { p_request: string }
        Returns: Json
      }
      aqlam_decide_guardian_request: {
        Args: { p_approve: boolean; p_note?: string; p_request: string }
        Returns: Json
      }
      aqlam_set_pin: {
        Args: { p_op: string; p_post: string }
        Returns: Json
      }
      aqlam_purge_removed: {
        Args: { p_days?: number }
        Returns: Json
      }
      aqlam_request_comments_lock: {
        Args: { p_child: string; p_reason: string }
        Returns: Json
      }
      aqlam_guardian_decide: {
        Args: { p_approve: boolean; p_post: string }
        Returns: Json
      }
      aqlam_handle_report: {
        Args: { p_report: string; p_status: string }
        Returns: Json
      }
      aqlam_moderate_comment: {
        Args: { p_action: string; p_comment: string }
        Returns: Json
      }
      aqlam_moderate_post: {
        Args: { p_action: string; p_post: string; p_reason?: string }
        Returns: Json
      }
      aqlam_publish_post: {
        Args: {
          p_allow_indexing: boolean
          p_birth_date: string | null
          p_body: string
          p_category: string
          p_comments_enabled: boolean
          p_consent_version: string
          p_name_mode: string
          p_pen_name: string | null
          p_source_document_id: string | null
          p_title: string
        }
        Returns: Json
      }
      aqlam_my_status: {
        Args: never
        Returns: Json
      }
      aqlam_remove_own_post: {
        Args: { p_post: string }
        Returns: Json
      }
      aqlam_report: {
        Args: {
          p_details?: string
          p_reason: string
          p_target_id: string
          p_target_type: string
        }
        Returns: Json
      }
      aqlam_sanction_user: {
        Args: { p_kind: string; p_reason: string; p_user: string }
        Returns: Json
      }
      aqlam_save_config: {
        Args: { p_private?: Json; p_value: Json }
        Returns: Json
      }
      aqlam_set_guardian_settings: {
        Args: {
          p_child: string
          p_comments_allowed: boolean
          p_publishing_allowed: boolean
        }
        Returns: Json
      }
      aqlam_set_reaction: {
        Args: { p_kind: string; p_on: boolean; p_post: string }
        Returns: Json
      }
      effective_price: {
        Args: { p_at?: string; p_base: number; p_id: string; p_type: string }
        Returns: number
      }
      shipping_quote: {
        Args: { p_city: string; p_country: string; p_governorate: string }
        Returns: {
          available: boolean
          fee: number
          message: string
          reason: string
        }[]
      }
      cancel_my_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      delete_instructor: {
        Args: { p_instructor_id: string }
        Returns: Json
      }
      transfer_instructor_work: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      transfer_provider_work: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      join_request_thread: {
        Args: { p_token: string }
        Returns: Json
      }
      join_request_reply: {
        Args: { p_token: string; p_body: string }
        Returns: Json
      }
      cancel_course_booking: {
        Args: { p_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_my_booking: {
        Args: { p_id: string }
        Returns: Json
      }
      cancel_my_service_order: {
        Args: { p_id: string }
        Returns: Json
      }
      attach_payment_session_cw: {
        Args: { p_kind: string; p_id: string; p_session_id: string }
        Returns: Json
      }
      record_gateway_payment_cw: {
        Args: {
          p_amount_minor: number | null
          p_event_id: string
          p_event_type: string
          p_id: string
          p_intent_id: string | null
          p_kind: string
          p_method: string | null
          p_payload?: Json | null
          p_session_id: string | null
        }
        Returns: Json
      }
      attach_payment_session: {
        Args: { p_order_id: string; p_session_id: string }
        Returns: Json
      }
      record_gateway_payment: {
        Args: {
          p_amount_minor: number | null
          p_event_id: string
          p_event_type: string
          p_intent_id: string | null
          p_method: string | null
          p_order_id: string
          p_payload?: Json | null
          p_session_id: string | null
        }
        Returns: Json
      }
      account_activity: { Args: { p_user: string }; Returns: Json }
      admin_purge_account: { Args: { p_user: string }; Returns: string[] }
      all_cloudinary_urls: { Args: { p_urls: string[] }; Returns: boolean }
      apply_dependent_name_change: {
        Args: { p_request_id: string }
        Returns: Json
      }
      can_access_service_order: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      can_see_dependent_request: {
        Args: { p_child_profile_id: string }
        Returns: boolean
      }
      can_see_profile: { Args: { p_id: string }; Returns: boolean }
      cancel_private_file_upload_intent: {
        Args: { p_actor_id: string; p_intent_id: string }
        Returns: boolean
      }
      cancel_stale_pending_orders: {
        Args: { p_days: number; p_now: string }
        Returns: number
      }
      claim_private_file_cleanup_jobs: {
        Args: { p_limit?: number; p_now?: string; p_retention_days?: number }
        Returns: Json
      }
      complete_private_file_cleanup_job: {
        Args: {
          p_claim_token: string
          p_error?: string
          p_job_id: string
          p_now?: string
          p_success: boolean
        }
        Returns: boolean
      }
      create_box_subscription_order: {
        Args: {
          p_details: Json
          p_discount_code?: string
          p_plan_id: string
          p_shipping: Json
        }
        Returns: string
      }
      create_course_booking: {
        Args: {
          p_child_id?: string
          p_discount_code?: string
          p_gift_message?: string
          p_instructor_id?: string
          p_package_id: string
          p_participant_type?: string
        }
        Returns: string
      }
      create_customer_order: {
        Args: { p_discount_code?: string; p_items: Json; p_shipping?: Json }
        Returns: string
      }
      create_private_file_upload_intent: {
        Args: {
          p_actor_id: string
          p_expected_bytes: number
          p_file_ext: string
          p_file_name: string
          p_max_bytes: number
          p_now?: string
          p_owner_id: string
          p_owner_kind: string
          p_resource_type: string
        }
        Returns: Json
      }
      deliver_stale_order_notifications: {
        Args: { p_limit?: number }
        Returns: {
          delivered_count: number
          failed_count: number
          pending_count: number
        }[]
      }
      discount_code_check: {
        Args: { p_code: string; p_line: string }
        Returns: Json
      }
      discount_code_record: {
        Args: {
          p_amount: number
          p_code_id: string
          p_line: string
          p_source_id: string
          p_user: string
        }
        Returns: undefined
      }
      discount_code_take: {
        Args: {
          p_code: string
          p_line: string
          p_lock: boolean
          p_user: string
        }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          lines: string[] | null
          max_uses: number | null
          note: string | null
          percent: number
          starts_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "discount_codes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_private_file_upload: {
        Args: {
          p_actor_id: string
          p_intent_id: string
          p_is_delivery?: boolean
          p_metadata: Json
          p_now?: string
        }
        Returns: Json
      }
      guardian_of_student: { Args: { p_student: string }; Returns: boolean }
      instructor_sessions: {
        Args: never
        Returns: {
          child_ref: string
          meeting_url: string
          package_id: string
          package_name: string
          participant_name: string
          scheduled_at: string
          session_id: string
          session_number: number
          status: string
          subscription_id: string
          user_ref: string
        }[]
      }
      instructor_students: {
        Args: never
        Returns: {
          child_ref: string
          documents_ref: string
          package_name: string
          participant_name: string
          sessions_completed: number
          sessions_total: number
          subscription_id: string
          subscription_status: string
          user_ref: string
        }[]
      }
      instructor_teaches: { Args: { p_student: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_instructor: { Args: never; Returns: boolean }
      is_my_child_subscription: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      my_dependent_link: {
        Args: never
        Returns: {
          child_profile_id: string
          full_name: string
          guardian_profile_id: string
        }[]
      }
      my_story_previews: {
        Args: { p_order_id: string }
        Returns: {
          project_id: string
          order_item_id: string
          product_id: string
          project_status: string
          version_id: string
          version_no: number
          body: string
          version_status: string
          sent_at: string
          decision_at: string | null
          decision_note: string | null
          decided_by_me: boolean | null
        }[]
      }
      story_preview_decide: {
        Args: { p_version_id: string; p_approve: boolean; p_note?: string | null }
        Returns: string
      }
      story_version_send_to_client: {
        Args: { p_version_id: string }
        Returns: string
      }
      training_course_for_me: { Args: { p_course: string }; Returns: Json }
      training_start: { Args: { p_course: string }; Returns: undefined }
      training_heartbeat: { Args: { p_course: string; p_seconds: number }; Returns: undefined }
      training_submit_module: {
        Args: { p_course: string; p_module: number; p_answers: Json }
        Returns: Json
      }
      training_submit_final: { Args: { p_course: string; p_answers: Json }; Returns: Json }
      training_reset_progress: { Args: { p_user: string; p_course: string }; Returns: undefined }
      story_image_send: {
        Args: { p_project_id: string; p_note?: string | null }
        Returns: string
      }
      my_story_image_reviews: {
        Args: { p_order_id: string }
        Returns: {
          project_id: string
          order_item_id: string
          product_id: string
          review_id: string
          image_url: string
          staff_note: string | null
          status: string
          sent_at: string
          decided_at: string | null
          client_note: string | null
          character_approved: boolean | null
        }[]
      }
      story_image_decide: {
        Args: { p_review_id: string; p_approve: boolean; p_note?: string | null }
        Returns: string
      }
      next_payment_reference: { Args: never; Returns: string }
      notify_admins: {
        Args: { p_link?: string; p_message?: string; p_title: string }
        Returns: number
      }
      notify_broadcast: {
        Args: {
          p_link?: string
          p_message?: string
          p_role?: string
          p_title: string
        }
        Returns: number
      }
      notify_user: {
        Args: {
          p_link?: string
          p_message?: string
          p_recipient: string
          p_title: string
        }
        Returns: undefined
      }
      owns_instructor: { Args: { p_instructor_id: string }; Returns: boolean }
      private_file_can_upload: {
        Args: { p_actor_id: string; p_owner_id: string; p_owner_kind: string }
        Returns: boolean
      }
      private_file_can_manage_document: {
        Args: { p_actor_id: string; p_student_id: string }
        Returns: boolean
      }
      delete_private_file_document: {
        Args: { p_actor_id: string; p_document_id: string }
        Returns: boolean
      }
      public_instructor: {
        Args: { p_id: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          id: string
          is_sample: boolean
          package_ids: string[]
          specialties: string[]
          status: string
          user_id: string
          weekly_schedule: Json
          years_experience: number
        }[]
      }
      public_instructors: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          id: string
          is_sample: boolean
          package_ids: string[]
          specialties: string[]
          status: string
          user_id: string
          weekly_schedule: Json
          years_experience: number
        }[]
      }
      record_order_publisher_earnings: {
        Args: { p_order_id: string }
        Returns: Json
      }
      record_service_order_earning: {
        Args: { p_order_id: string }
        Returns: Json
      }
      request_private_file_deletion: {
        Args: { p_actor_id: string; p_file_id: string; p_now?: string }
        Returns: Json
      }
      set_instructor_packages: {
        Args: { p_instructor_id: string; p_package_ids: string[] }
        Returns: Json
      }
      work_tasks_sweep_if_due: { Args: never; Returns: Json }
      work_tasks_deadline_sweep: { Args: never; Returns: Json }
      story_backfill_pending: { Args: never; Returns: number }
      story_backfill_projects: { Args: never; Returns: number }
      story_mode: { Args: never; Returns: string }
      story_start_project: { Args: { p_order_item: string }; Returns: string }
      story_studio_access: { Args: never; Returns: boolean }
      order_studio_projects: {
        Args: { p_order: string }
        Returns: {
          child_name: string | null
          due_at: string | null
          held_from: string | null
          id: string
          order_closed: boolean
          order_item_id: string
          status: string
        }[]
      }
      studio_stage_create: {
        Args: { p_after: string; p_hint?: string; p_label: string; p_owner?: string; p_sla?: number }
        Returns: string
      }
      studio_stage_move: { Args: { p_dir: number; p_step: string }; Returns: undefined }
      studio_stage_delete: { Args: { p_step: string }; Returns: undefined }
      studio_stage_flow: {
        Args: { p_abilities: string[]; p_active: boolean; p_advance_by: string; p_gates: string[]; p_optional?: boolean; p_step: string }
        Returns: undefined
      }
      studio_edges_set: { Args: { p_edges: Json; p_from: string }; Returns: undefined }
      studio_route_set: {
        Args: { p_gates_off?: string[]; p_product: string; p_state: string; p_step: string }
        Returns: undefined
      }
      studio_route_reset: { Args: { p_product: string }; Returns: number }
      box_shipment_tasks_sync: { Args: never; Returns: Json }
      task_rule_apply: { Args: { p_line: string; p_step: string }; Returns: number }
      student_sessions: {
        Args: never
        Returns: {
          instructor_name: string
          meeting_url: string
          package_name: string
          scheduled_at: string
          session_id: string
          session_number: number
          status: string
        }[]
      }
      used_line: { Args: { p_line: string; p_user: string }; Returns: boolean }
      valid_applies_to: { Args: { p: string[] }; Returns: boolean }
      work_task_close: {
        Args: { p_line: string; p_source: string; p_stage: string }
        Returns: undefined
      }
      work_task_open: {
        Args: {
          p_line: string
          p_link: string
          p_notify: boolean
          p_reference: string
          p_source: string
          p_stage: string
          p_step?: string
          p_title: string
        }
        Returns: undefined
      }
    }
    Enums: {
      age_group: "under_12" | "12_plus"
      document_status_enum: "draft" | "submitted" | "reviewed"
      instructor_status_enum:
        | "pending_training"
        | "pending_approval"
        | "active"
        | "hidden"
        | "suspended"
      join_request_status_enum: "pending" | "approved" | "rejected"
      order_status_enum:
        | "pending"
        | "awaiting_verification"
        | "paid"
        | "failed"
        | "refunded"
        | "preparing"
        | "shipped"
        | "delivered"
        | "cancelled"
      owner_type: "platform" | "publisher"
      payout_status_enum: "pending" | "paid"
      product_category: "library" | "custom" | "subscription"
      provider_kind: "platform" | "instructor" | "individual"
      provider_status: "pending" | "active" | "suspended"
      publisher_status_enum: "pending" | "active" | "suspended"
      service_order_status:
        | "pending"
        | "awaiting_verification"
        | "paid"
        | "refunded"
        | "in_progress"
        | "delivered"
        | "completed"
        | "cancelled"
      sub_status_enum: "active" | "cancelled" | "paused"
      support_session_status_enum: "pending" | "contacted" | "resolved"
      ticket_status_enum: "open" | "answered" | "closed"
      update_request_status: "pending" | "approved" | "rejected"
      user_role_enum:
        | "visitor"
        | "customer"
        | "student"
        | "instructor"
        | "publisher"
        | "general_supervisor"
        | "super_admin"
        | "service_provider"
      work_model_enum: "per_session" | "monthly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      age_group: ["under_12", "12_plus"],
      document_status_enum: ["draft", "submitted", "reviewed"],
      instructor_status_enum: [
        "pending_training",
        "pending_approval",
        "active",
        "hidden",
        "suspended",
      ],
      join_request_status_enum: ["pending", "approved", "rejected"],
      order_status_enum: [
        "pending",
        "awaiting_verification",
        "paid",
        "failed",
        "refunded",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      owner_type: ["platform", "publisher"],
      payout_status_enum: ["pending", "paid"],
      product_category: ["library", "custom", "subscription"],
      provider_kind: ["platform", "instructor", "individual"],
      provider_status: ["pending", "active", "suspended"],
      publisher_status_enum: ["pending", "active", "suspended"],
      service_order_status: [
        "pending",
        "awaiting_verification",
        "paid",
        "refunded",
        "in_progress",
        "delivered",
        "completed",
        "cancelled",
      ],
      sub_status_enum: ["active", "cancelled", "paused"],
      support_session_status_enum: ["pending", "contacted", "resolved"],
      ticket_status_enum: ["open", "answered", "closed"],
      update_request_status: ["pending", "approved", "rejected"],
      user_role_enum: [
        "visitor",
        "customer",
        "student",
        "instructor",
        "publisher",
        "general_supervisor",
        "super_admin",
        "service_provider",
      ],
      work_model_enum: ["per_session", "monthly"],
    },
  },
} as const
