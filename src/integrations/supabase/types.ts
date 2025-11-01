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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          click_id: string | null
          created_at: string | null
          id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_id: string
          click_id?: string | null
          created_at?: string | null
          id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_id?: string
          click_id?: string | null
          created_at?: string | null
          id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          amount: number
          commission_rate: number
          conversion_id: string
          created_at: string | null
          id: string
          level: number
        }
        Insert: {
          affiliate_id: string
          amount: number
          commission_rate: number
          conversion_id: string
          created_at?: string | null
          id?: string
          level: number
        }
        Update: {
          affiliate_id?: string
          amount?: number
          commission_rate?: number
          conversion_id?: string
          created_at?: string | null
          id?: string
          level?: number
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_conversion_id_fkey"
            columns: ["conversion_id"]
            isOneToOne: false
            referencedRelation: "affiliate_conversions"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string | null
          id: string
          plan: string
          status: string | null
          user_id: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string | null
          id?: string
          plan: string
          status?: string | null
          user_id: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string | null
          id?: string
          plan?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string | null
          id: string
          paid_at: string | null
          period: string
          status: string | null
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string | null
          id?: string
          paid_at?: string | null
          period: string
          status?: string | null
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string | null
          id?: string
          paid_at?: string | null
          period?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          active_direct_referrals: number | null
          affiliate_status: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          parent_id: string | null
          payout_method: string | null
          status: string | null
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean | null
          stripe_connect_onboarding_complete: boolean | null
          stripe_connect_payouts_enabled: boolean | null
          total_referrals_level_2: number | null
          total_referrals_level_3: number | null
        }
        Insert: {
          active_direct_referrals?: number | null
          affiliate_status?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          parent_id?: string | null
          payout_method?: string | null
          status?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean | null
          stripe_connect_onboarding_complete?: boolean | null
          stripe_connect_payouts_enabled?: boolean | null
          total_referrals_level_2?: number | null
          total_referrals_level_3?: number | null
        }
        Update: {
          active_direct_referrals?: number | null
          affiliate_status?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          parent_id?: string | null
          payout_method?: string | null
          status?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean | null
          stripe_connect_onboarding_complete?: boolean | null
          stripe_connect_payouts_enabled?: boolean | null
          total_referrals_level_2?: number | null
          total_referrals_level_3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      alfie_cache: {
        Row: {
          created_at: string | null
          id: string
          prompt_hash: string
          prompt_type: string
          response: Json
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prompt_hash: string
          prompt_type: string
          response: Json
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          prompt_hash?: string
          prompt_type?: string
          response?: Json
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      alfie_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alfie_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          role: string
          video_url: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
          video_url?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alfie_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "alfie_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_requests: {
        Row: {
          created_at: string | null
          id: string
          modality: string
          payload_json: Json
          process_after: string
          result_json: Json | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          modality: string
          payload_json: Json
          process_after: string
          result_json?: Json | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          modality?: string
          payload_json?: Json
          process_after?: string
          result_json?: Json | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          canva_access_token: string | null
          canva_connected: boolean | null
          canva_refresh_token: string | null
          canva_team_id: string | null
          created_at: string | null
          fonts: Json | null
          id: string
          images_used: number | null
          is_addon: boolean | null
          logo_url: string | null
          name: string
          palette: Json | null
          plan: string | null
          quota_images: number | null
          quota_videos: number | null
          quota_woofs: number | null
          resets_on: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
          videos_used: number | null
          voice: string | null
          woofs_used: number | null
        }
        Insert: {
          canva_access_token?: string | null
          canva_connected?: boolean | null
          canva_refresh_token?: string | null
          canva_team_id?: string | null
          created_at?: string | null
          fonts?: Json | null
          id?: string
          images_used?: number | null
          is_addon?: boolean | null
          logo_url?: string | null
          name: string
          palette?: Json | null
          plan?: string | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          resets_on?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
          videos_used?: number | null
          voice?: string | null
          woofs_used?: number | null
        }
        Update: {
          canva_access_token?: string | null
          canva_connected?: boolean | null
          canva_refresh_token?: string | null
          canva_team_id?: string | null
          created_at?: string | null
          fonts?: Json | null
          id?: string
          images_used?: number | null
          is_addon?: boolean | null
          logo_url?: string | null
          name?: string
          palette?: Json | null
          plan?: string | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          resets_on?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
          videos_used?: number | null
          voice?: string | null
          woofs_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      canva_designs: {
        Row: {
          canva_url: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string
          title: string
          updated_at: string
        }
        Insert: {
          canva_url: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          title: string
          updated_at?: string
        }
        Update: {
          canva_url?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      counters_monthly: {
        Row: {
          brand_id: string
          images_used: number
          period_yyyymm: number
          reels_used: number
          woofs_used: number
        }
        Insert: {
          brand_id: string
          images_used?: number
          period_yyyymm: number
          reels_used?: number
          woofs_used?: number
        }
        Update: {
          brand_id?: string
          images_used?: number
          period_yyyymm?: number
          reels_used?: number
          woofs_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "counters_monthly_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          created_at: string | null
          credits: number
          discount_percentage: number | null
          id: string
          name: string
          price_cents: number
          stripe_price_id: string
        }
        Insert: {
          created_at?: string | null
          credits: number
          discount_percentage?: number | null
          id?: string
          name: string
          price_cents: number
          stripe_price_id: string
        }
        Update: {
          created_at?: string | null
          credits?: number
          discount_percentage?: number | null
          id?: string
          name?: string
          price_cents?: number
          stripe_price_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          action: string | null
          amount: number
          created_at: string | null
          id: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          action?: string | null
          amount: number
          created_at?: string | null
          id?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          action?: string | null
          amount?: number
          created_at?: string | null
          id?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable: {
        Row: {
          brand_id: string
          canva_link: string | null
          created_at: string
          format: string
          id: string
          metadata: Json | null
          objective: string | null
          preview_url: string | null
          status: string
          style_choice: string | null
          updated_at: string | null
          zip_url: string | null
        }
        Insert: {
          brand_id: string
          canva_link?: string | null
          created_at?: string
          format: string
          id?: string
          metadata?: Json | null
          objective?: string | null
          preview_url?: string | null
          status?: string
          style_choice?: string | null
          updated_at?: string | null
          zip_url?: string | null
        }
        Update: {
          brand_id?: string
          canva_link?: string | null
          created_at?: string
          format?: string
          id?: string
          metadata?: Json | null
          objective?: string | null
          preview_url?: string | null
          status?: string
          style_choice?: string | null
          updated_at?: string | null
          zip_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          allowed_plans: string[] | null
          allowed_roles: string[] | null
          created_at: string | null
          enabled: boolean | null
          feature: string
          updated_at: string | null
        }
        Insert: {
          allowed_plans?: string[] | null
          allowed_roles?: string[] | null
          created_at?: string | null
          enabled?: boolean | null
          feature: string
          updated_at?: string | null
        }
        Update: {
          allowed_plans?: string[] | null
          allowed_roles?: string[] | null
          created_at?: string | null
          enabled?: boolean | null
          feature?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      generation_logs: {
        Row: {
          brand_id: string | null
          created_at: string
          duration_seconds: number | null
          engine: string | null
          error_code: string | null
          id: string
          metadata: Json | null
          prompt_summary: string | null
          status: string
          type: string
          user_id: string
          woofs_cost: number | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          engine?: string | null
          error_code?: string | null
          id?: string
          metadata?: Json | null
          prompt_summary?: string | null
          status: string
          type: string
          user_id: string
          woofs_cost?: number | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          engine?: string | null
          error_code?: string | null
          id?: string
          metadata?: Json | null
          prompt_summary?: string | null
          status?: string
          type?: string
          user_id?: string
          woofs_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          id: string
          input_data: Json | null
          max_retries: number | null
          output_data: Json | null
          progress: number | null
          retry_count: number | null
          short_id: string | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          input_data?: Json | null
          max_retries?: number | null
          output_data?: Json | null
          progress?: number | null
          retry_count?: number | null
          short_id?: string | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          input_data?: Json | null
          max_retries?: number | null
          output_data?: Json | null
          progress?: number | null
          retry_count?: number | null
          short_id?: string | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      media_generations: {
        Row: {
          brand_id: string | null
          brand_score: number | null
          cost_woofs: number | null
          created_at: string | null
          duration_seconds: number | null
          engine: Database["public"]["Enums"]["video_engine"] | null
          error_json: Json | null
          expires_at: string | null
          file_size_bytes: number | null
          id: string
          input_url: string | null
          is_source_upload: boolean | null
          job_id: string | null
          metadata: Json | null
          modality: string | null
          output_url: string
          params_json: Json | null
          prompt: string | null
          provider_id: string | null
          render_url: string | null
          status: string
          thumbnail_url: string | null
          type: string
          updated_at: string | null
          user_id: string
          woofs: number | null
        }
        Insert: {
          brand_id?: string | null
          brand_score?: number | null
          cost_woofs?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          engine?: Database["public"]["Enums"]["video_engine"] | null
          error_json?: Json | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          input_url?: string | null
          is_source_upload?: boolean | null
          job_id?: string | null
          metadata?: Json | null
          modality?: string | null
          output_url: string
          params_json?: Json | null
          prompt?: string | null
          provider_id?: string | null
          render_url?: string | null
          status?: string
          thumbnail_url?: string | null
          type: string
          updated_at?: string | null
          user_id: string
          woofs?: number | null
        }
        Update: {
          brand_id?: string | null
          brand_score?: number | null
          cost_woofs?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          engine?: Database["public"]["Enums"]["video_engine"] | null
          error_json?: Json | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          input_url?: string | null
          is_source_upload?: boolean | null
          job_id?: string | null
          metadata?: Json | null
          modality?: string | null
          output_url?: string
          params_json?: Json | null
          prompt?: string | null
          provider_id?: string | null
          render_url?: string | null
          status?: string
          thumbnail_url?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
          woofs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_generations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_generations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_generations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_sessions: {
        Row: {
          amount: number | null
          created_at: string | null
          email: string | null
          id: string
          plan: string
          processed_at: string
          session_id: string
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          plan: string
          processed_at?: string
          session_id: string
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          plan?: string
          processed_at?: string
          session_id?: string
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      payment_verification_log: {
        Row: {
          created_at: string | null
          error_details: string | null
          id: string
          ip_address: string | null
          result: string
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_details?: string | null
          id?: string
          ip_address?: string | null
          result: string
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_details?: string | null
          id?: string
          ip_address?: string | null
          result?: string
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      plans_config: {
        Row: {
          created_at: string | null
          durations: string
          plan: string
          price_eur: number
          storage_days: number
          visuals_per_month: number
          woofs_per_month: number
        }
        Insert: {
          created_at?: string | null
          durations: string
          plan: string
          price_eur: number
          storage_days: number
          visuals_per_month: number
          woofs_per_month: number
        }
        Update: {
          created_at?: string | null
          durations?: string
          plan?: string
          price_eur?: number
          storage_days?: number
          visuals_per_month?: number
          woofs_per_month?: number
        }
        Relationships: []
      }
      posts: {
        Row: {
          brand_key: string | null
          canva_design_id: string | null
          created_at: string | null
          id: string
          planner_deep_link: string | null
          status: string | null
          suggested_slots: Json | null
          template_key: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          brand_key?: string | null
          canva_design_id?: string | null
          created_at?: string | null
          id?: string
          planner_deep_link?: string | null
          status?: string | null
          suggested_slots?: Json | null
          template_key?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          brand_key?: string | null
          canva_design_id?: string | null
          created_at?: string | null
          id?: string
          planner_deep_link?: string | null
          status?: string | null
          suggested_slots?: Json | null
          template_key?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_brand_id: string | null
          ai_credits_from_affiliation: number | null
          ai_credits_monthly: number | null
          ai_credits_purchased: number | null
          alfie_requests_reset_date: string | null
          alfie_requests_this_month: number | null
          avatar_url: string | null
          created_at: string | null
          credits_reset_date: string | null
          email: string
          full_name: string | null
          generations_reset_date: string | null
          generations_this_month: number | null
          granted_by_admin: boolean | null
          id: string
          plan: string | null
          quota_brands: number | null
          quota_videos: number | null
          quota_visuals_per_month: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          videos_this_month: number | null
          woofs_consumed_this_month: number | null
        }
        Insert: {
          active_brand_id?: string | null
          ai_credits_from_affiliation?: number | null
          ai_credits_monthly?: number | null
          ai_credits_purchased?: number | null
          alfie_requests_reset_date?: string | null
          alfie_requests_this_month?: number | null
          avatar_url?: string | null
          created_at?: string | null
          credits_reset_date?: string | null
          email: string
          full_name?: string | null
          generations_reset_date?: string | null
          generations_this_month?: number | null
          granted_by_admin?: boolean | null
          id: string
          plan?: string | null
          quota_brands?: number | null
          quota_videos?: number | null
          quota_visuals_per_month?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          videos_this_month?: number | null
          woofs_consumed_this_month?: number | null
        }
        Update: {
          active_brand_id?: string | null
          ai_credits_from_affiliation?: number | null
          ai_credits_monthly?: number | null
          ai_credits_purchased?: number | null
          alfie_requests_reset_date?: string | null
          alfie_requests_this_month?: number | null
          avatar_url?: string | null
          created_at?: string | null
          credits_reset_date?: string | null
          email?: string
          full_name?: string | null
          generations_reset_date?: string | null
          generations_this_month?: number | null
          granted_by_admin?: boolean | null
          id?: string
          plan?: string | null
          quota_brands?: number | null
          quota_videos?: number | null
          quota_visuals_per_month?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          videos_this_month?: number | null
          woofs_consumed_this_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_brand_id_fkey"
            columns: ["active_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_metrics: {
        Row: {
          avg_reward: number | null
          format: string
          last_updated: string | null
          provider_id: string
          successes: number | null
          total_reward: number | null
          trials: number | null
          use_case: string
        }
        Insert: {
          avg_reward?: number | null
          format: string
          last_updated?: string | null
          provider_id: string
          successes?: number | null
          total_reward?: number | null
          trials?: number | null
          use_case: string
        }
        Update: {
          avg_reward?: number | null
          format?: string
          last_updated?: string | null
          provider_id?: string
          successes?: number | null
          total_reward?: number | null
          trials?: number | null
          use_case?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          avg_latency_s: number
          cost_json: Json
          enabled: boolean
          fail_rate: number
          family: string
          formats: string[]
          id: string
          modalities: string[]
          quality_score: number
          strengths: string[]
          updated_at: string
        }
        Insert: {
          avg_latency_s?: number
          cost_json: Json
          enabled?: boolean
          fail_rate?: number
          family: string
          formats: string[]
          id: string
          modalities: string[]
          quality_score?: number
          strengths: string[]
          updated_at?: string
        }
        Update: {
          avg_latency_s?: number
          cost_json?: Json
          enabled?: boolean
          fail_rate?: number
          family?: string
          formats?: string[]
          id?: string
          modalities?: string[]
          quality_score?: number
          strengths?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          canva_template_id: string
          created_at: string | null
          folder_path: string | null
          id: string
          key: string
          ratios: Json | null
          variables: Json | null
        }
        Insert: {
          canva_template_id: string
          created_at?: string | null
          folder_path?: string | null
          id?: string
          key: string
          ratios?: Json | null
          variables?: Json | null
        }
        Update: {
          canva_template_id?: string
          created_at?: string | null
          folder_path?: string | null
          id?: string
          key?: string
          ratios?: Json | null
          variables?: Json | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_at: string
          delta_woofs: number
          meta: Json | null
          reason: string
          tx_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_woofs: number
          meta?: Json | null
          reason: string
          tx_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta_woofs?: number
          meta?: Json | null
          reason?: string
          tx_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_event: {
        Row: {
          brand_id: string
          created_at: string
          deliverable_id: string | null
          id: string
          kind: string
          meta: Json | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          deliverable_id?: string | null
          id?: string
          kind: string
          meta?: Json | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          deliverable_id?: string | null
          id?: string
          kind?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_event_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_event_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverable"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_segments: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          id: string
          is_temporary: boolean | null
          parent_video_id: string | null
          segment_index: number
          segment_url: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_temporary?: boolean | null
          parent_video_id?: string | null
          segment_index: number
          segment_url: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_temporary?: boolean | null
          parent_video_id?: string | null
          segment_index?: number
          segment_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_segments_parent_video_id_fkey"
            columns: ["parent_video_id"]
            isOneToOne: false
            referencedRelation: "media_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          assets: Json | null
          brand_id: string | null
          created_at: string | null
          duration: number
          error_message: string | null
          expires_at: string | null
          file_size_bytes: number | null
          id: string
          ratio: string
          rendering_completed_at: string | null
          rendering_started_at: string | null
          status: string
          template_id: string | null
          thumbnail_url: string | null
          title: string
          tts_config: Json | null
          updated_at: string | null
          user_id: string
          video_url: string | null
          woofs_cost: number
        }
        Insert: {
          assets?: Json | null
          brand_id?: string | null
          created_at?: string | null
          duration: number
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          ratio?: string
          rendering_completed_at?: string | null
          rendering_started_at?: string | null
          status?: string
          template_id?: string | null
          thumbnail_url?: string | null
          title: string
          tts_config?: Json | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
          woofs_cost?: number
        }
        Update: {
          assets?: Json | null
          brand_id?: string | null
          created_at?: string | null
          duration?: number
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          ratio?: string
          rendering_completed_at?: string | null
          rendering_started_at?: string | null
          status?: string
          template_id?: string | null
          thumbnail_url?: string | null
          title?: string
          tts_config?: Json | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
          woofs_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "videos_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      woof_pack_purchases: {
        Row: {
          created_at: string | null
          id: string
          pack_id: string
          price_eur: number
          status: string | null
          stripe_payment_intent_id: string | null
          user_id: string
          woofs: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          pack_id: string
          price_eur: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
          woofs: number
        }
        Update: {
          created_at?: string | null
          id?: string
          pack_id?: string
          price_eur?: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
          woofs?: number
        }
        Relationships: [
          {
            foreignKeyName: "woof_pack_purchases_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "woof_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      woof_packs: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          price_eur: number
          stripe_price_id: string | null
          woofs: number
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          price_eur: number
          stripe_price_id?: string | null
          woofs: number
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          price_eur?: number
          stripe_price_id?: string | null
          woofs?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_mlm_commissions: {
        Args: {
          conversion_amount: number
          conversion_id_param: string
          direct_affiliate_id: string
        }
        Returns: undefined
      }
      calculate_woofs_cost: {
        Args: { duration_seconds: number }
        Returns: number
      }
      can_create_video: {
        Args: { duration_seconds: number; user_id_param: string }
        Returns: {
          can_create: boolean
          reason: string
          woofs_available: number
          woofs_needed: number
        }[]
      }
      consume_woofs: {
        Args: { user_id_param: string; woofs_amount: number }
        Returns: boolean
      }
      generate_short_job_id: { Args: never; Returns: string }
      has_active_plan: { Args: { user_id_param: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_alfie_requests: {
        Args: { user_id_param: string }
        Returns: number
      }
      increment_monthly_counters: {
        Args: {
          p_brand_id: string
          p_images?: number
          p_period_yyyymm: number
          p_reels?: number
          p_woofs?: number
        }
        Returns: undefined
      }
      increment_profile_visuals: {
        Args: { p_delta?: number; p_profile_id: string }
        Returns: undefined
      }
      refund_woofs: {
        Args: { user_id_param: string; woofs_amount: number }
        Returns: boolean
      }
      update_affiliate_status: {
        Args: { affiliate_id_param: string }
        Returns: undefined
      }
      user_has_access: { Args: { user_id_param: string }; Returns: boolean }
    }
    Enums: {
      app_role: "user" | "admin" | "affiliate" | "vip"
      asset_engine: "nano" | "sora" | "veo3"
      brand_plan: "starter" | "pro" | "studio"
      plan_type: "starter" | "pro" | "studio"
      video_engine: "sora" | "seededance" | "kling"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["user", "admin", "affiliate", "vip"],
      asset_engine: ["nano", "sora", "veo3"],
      brand_plan: ["starter", "pro", "studio"],
      plan_type: ["starter", "pro", "studio"],
      video_engine: ["sora", "seededance", "kling"],
    },
  },
} as const
