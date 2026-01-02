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
          slug: string | null
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
          slug?: string | null
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
          slug?: string | null
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
      ai_tools_daily_usage: {
        Row: {
          created_at: string
          date: string
          id: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
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
      alfie_conversation_sessions: {
        Row: {
          brand_id: string | null
          context_json: Json
          conversation_state: string
          created_at: string | null
          id: string
          messages: Json
          order_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          context_json?: Json
          conversation_state?: string
          created_at?: string | null
          id?: string
          messages?: Json
          order_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          context_json?: Json
          conversation_state?: string
          created_at?: string | null
          id?: string
          messages?: Json
          order_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alfie_conversation_sessions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alfie_conversation_sessions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "alfie_conversation_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      alfie_memory: {
        Row: {
          brand_id: string | null
          created_at: string | null
          custom_terms: Json | null
          default_cta: string | null
          default_language: string | null
          default_platform: string | null
          default_ratio: string | null
          default_slides: number | null
          default_tone: string | null
          id: string
          last_format: string | null
          last_topic: string | null
          learned_shortcuts: Json | null
          preferred_goals: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          custom_terms?: Json | null
          default_cta?: string | null
          default_language?: string | null
          default_platform?: string | null
          default_ratio?: string | null
          default_slides?: number | null
          default_tone?: string | null
          id?: string
          last_format?: string | null
          last_topic?: string | null
          learned_shortcuts?: Json | null
          preferred_goals?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          custom_terms?: Json | null
          default_cta?: string | null
          default_language?: string | null
          default_platform?: string | null
          default_ratio?: string | null
          default_slides?: number | null
          default_tone?: string | null
          id?: string
          last_format?: string | null
          last_topic?: string | null
          learned_shortcuts?: Json | null
          preferred_goals?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alfie_memory_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alfie_memory_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      alfie_messages: {
        Row: {
          asset_id: string | null
          asset_type: string | null
          content: string
          conversation_id: string
          created_at: string
          engine: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          output_url: string | null
          role: string
          video_url: string | null
          woofs_consumed: number | null
        }
        Insert: {
          asset_id?: string | null
          asset_type?: string | null
          content: string
          conversation_id: string
          created_at?: string
          engine?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          output_url?: string | null
          role: string
          video_url?: string | null
          woofs_consumed?: number | null
        }
        Update: {
          asset_id?: string | null
          asset_type?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          engine?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          output_url?: string | null
          role?: string
          video_url?: string | null
          woofs_consumed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alfie_messages_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alfie_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "alfie_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          brand_id: string | null
          checksum: string | null
          created_at: string
          height: number | null
          id: string
          index_in_set: number | null
          job_id: string | null
          job_set_id: string | null
          meta: Json | null
          mime: string
          org_id: string | null
          storage_key: string
          width: number | null
        }
        Insert: {
          brand_id?: string | null
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: string
          index_in_set?: number | null
          job_id?: string | null
          job_set_id?: string | null
          meta?: Json | null
          mime?: string
          org_id?: string | null
          storage_key: string
          width?: number | null
        }
        Update: {
          brand_id?: string | null
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: string
          index_in_set?: number | null
          job_id?: string | null
          job_set_id?: string | null
          meta?: Json | null
          mime?: string
          org_id?: string | null
          storage_key?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "assets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_job_set_id_fkey"
            columns: ["job_set_id"]
            isOneToOne: false
            referencedRelation: "job_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_clips: {
        Row: {
          anchor_prompt: string | null
          anchor_public_id: string | null
          anchor_url: string | null
          clip_index: number
          clip_public_id: string | null
          clip_url: string | null
          created_at: string
          duration_seconds: number
          error: string | null
          id: string
          status: string
          veo_prompt: string | null
          video_id: string
        }
        Insert: {
          anchor_prompt?: string | null
          anchor_public_id?: string | null
          anchor_url?: string | null
          clip_index: number
          clip_public_id?: string | null
          clip_url?: string | null
          created_at?: string
          duration_seconds?: number
          error?: string | null
          id?: string
          status?: string
          veo_prompt?: string | null
          video_id: string
        }
        Update: {
          anchor_prompt?: string | null
          anchor_public_id?: string | null
          anchor_url?: string | null
          clip_index?: number
          clip_public_id?: string | null
          clip_url?: string | null
          created_at?: string
          duration_seconds?: number
          error?: string | null
          id?: string
          status?: string
          veo_prompt?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_clips_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "batch_videos"
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
      batch_video_texts: {
        Row: {
          caption: string | null
          clip1_subtitle: string | null
          clip1_title: string | null
          clip2_subtitle: string | null
          clip2_title: string | null
          clip3_subtitle: string | null
          clip3_title: string | null
          created_at: string
          cta: string | null
          id: string
          video_id: string
        }
        Insert: {
          caption?: string | null
          clip1_subtitle?: string | null
          clip1_title?: string | null
          clip2_subtitle?: string | null
          clip2_title?: string | null
          clip3_subtitle?: string | null
          clip3_title?: string | null
          created_at?: string
          cta?: string | null
          id?: string
          video_id: string
        }
        Update: {
          caption?: string | null
          clip1_subtitle?: string | null
          clip1_title?: string | null
          clip2_subtitle?: string | null
          clip2_title?: string | null
          clip3_subtitle?: string | null
          clip3_title?: string | null
          created_at?: string
          cta?: string | null
          id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_video_texts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "batch_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_videos: {
        Row: {
          batch_id: string
          created_at: string
          error: string | null
          id: string
          status: string
          title: string | null
          updated_at: string
          video_index: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          video_index: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          video_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "batch_videos_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "video_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          adjectives: string[] | null
          avatar_url: string | null
          avoid_in_visuals: string | null
          canva_access_token: string | null
          canva_connected: boolean | null
          canva_refresh_token: string | null
          canva_team_id: string | null
          created_at: string | null
          default_subject_pack_id: string | null
          fonts: Json | null
          id: string
          images_used: number | null
          is_addon: boolean | null
          is_default: boolean | null
          language_level: string | null
          logo_url: string | null
          name: string
          niche: string | null
          palette: Json | null
          person: string | null
          pitch: string | null
          plan: string | null
          quota_images: number | null
          quota_videos: number | null
          quota_woofs: number | null
          resets_on: string | null
          stripe_subscription_id: string | null
          tagline: string | null
          text_color: string | null
          tone_sliders: Json | null
          updated_at: string | null
          user_id: string
          videos_used: number | null
          visual_mood: string[] | null
          visual_types: string[] | null
          voice: string | null
          woofs_used: number | null
        }
        Insert: {
          adjectives?: string[] | null
          avatar_url?: string | null
          avoid_in_visuals?: string | null
          canva_access_token?: string | null
          canva_connected?: boolean | null
          canva_refresh_token?: string | null
          canva_team_id?: string | null
          created_at?: string | null
          default_subject_pack_id?: string | null
          fonts?: Json | null
          id?: string
          images_used?: number | null
          is_addon?: boolean | null
          is_default?: boolean | null
          language_level?: string | null
          logo_url?: string | null
          name: string
          niche?: string | null
          palette?: Json | null
          person?: string | null
          pitch?: string | null
          plan?: string | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          resets_on?: string | null
          stripe_subscription_id?: string | null
          tagline?: string | null
          text_color?: string | null
          tone_sliders?: Json | null
          updated_at?: string | null
          user_id: string
          videos_used?: number | null
          visual_mood?: string[] | null
          visual_types?: string[] | null
          voice?: string | null
          woofs_used?: number | null
        }
        Update: {
          adjectives?: string[] | null
          avatar_url?: string | null
          avoid_in_visuals?: string | null
          canva_access_token?: string | null
          canva_connected?: boolean | null
          canva_refresh_token?: string | null
          canva_team_id?: string | null
          created_at?: string | null
          default_subject_pack_id?: string | null
          fonts?: Json | null
          id?: string
          images_used?: number | null
          is_addon?: boolean | null
          is_default?: boolean | null
          language_level?: string | null
          logo_url?: string | null
          name?: string
          niche?: string | null
          palette?: Json | null
          person?: string | null
          pitch?: string | null
          plan?: string | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          resets_on?: string | null
          stripe_subscription_id?: string | null
          tagline?: string | null
          text_color?: string | null
          tone_sliders?: Json | null
          updated_at?: string | null
          user_id?: string
          videos_used?: number | null
          visual_mood?: string[] | null
          visual_types?: string[] | null
          voice?: string | null
          woofs_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_default_subject_pack_id_fkey"
            columns: ["default_subject_pack_id"]
            isOneToOne: false
            referencedRelation: "subject_packs"
            referencedColumns: ["id"]
          },
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
      chat_sessions: {
        Row: {
          brand_id: string | null
          context: Json
          created_at: string
          id: string
          last_interaction: string
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          context?: Json
          created_at?: string
          id?: string
          last_interaction?: string
          user_id: string
        }
        Update: {
          brand_id?: string | null
          context?: Json
          created_at?: string
          id?: string
          last_interaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
        ]
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
          {
            foreignKeyName: "counters_monthly_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
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
          {
            foreignKeyName: "deliverable_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      deliveries: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          meta_json: Json | null
          status: string | null
          type: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          meta_json?: Json | null
          status?: string | null
          type: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          meta_json?: Json | null
          status?: string | null
          type?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attempts: number
          created_at: string | null
          id: string
          last_error: string | null
          payload: Json | null
          run_after: string
          sent_at: string | null
          status: string
          template: string
          to_email: string
        }
        Insert: {
          attempts?: number
          created_at?: string | null
          id?: string
          last_error?: string | null
          payload?: Json | null
          run_after?: string
          sent_at?: string | null
          status?: string
          template: string
          to_email: string
        }
        Update: {
          attempts?: number
          created_at?: string | null
          id?: string
          last_error?: string | null
          payload?: Json | null
          run_after?: string
          sent_at?: string | null
          status?: string
          template?: string
          to_email?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "generation_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          result_ref: string | null
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          result_ref?: string | null
          status: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          result_ref?: string | null
          status?: string
        }
        Relationships: []
      }
      identity_anchors: {
        Row: {
          anchor_type: string
          brand_id: string | null
          constraints_json: Json | null
          created_at: string
          id: string
          name: string
          ref_image_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_type?: string
          brand_id?: string | null
          constraints_json?: Json | null
          created_at?: string
          id?: string
          name: string
          ref_image_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor_type?: string
          brand_id?: string | null
          constraints_json?: Json | null
          created_at?: string
          id?: string
          name?: string
          ref_image_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_anchors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_anchors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      job_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          job_id: string
          message: string | null
          metadata: Json | null
          step_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          job_id: string
          message?: string | null
          metadata?: Json | null
          step_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string
          message?: string | null
          metadata?: Json | null
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "job_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          brand_id: string | null
          brandkit_id: string | null
          character_anchor_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          kind: string | null
          max_attempts: number
          max_retries: number
          order_id: string | null
          payload: Json
          result: Json | null
          retry_count: number
          spec_json: Json | null
          started_at: string | null
          status: string
          template_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          brand_id?: string | null
          brandkit_id?: string | null
          character_anchor_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          kind?: string | null
          max_attempts?: number
          max_retries?: number
          order_id?: string | null
          payload: Json
          result?: Json | null
          retry_count?: number
          spec_json?: Json | null
          started_at?: string | null
          status?: string
          template_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          brand_id?: string | null
          brandkit_id?: string | null
          character_anchor_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          kind?: string | null
          max_attempts?: number
          max_retries?: number
          order_id?: string | null
          payload?: Json
          result?: Json | null
          retry_count?: number
          spec_json?: Json | null
          started_at?: string | null
          status?: string
          template_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_brandkit_id_fkey"
            columns: ["brandkit_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_queue_brandkit_id_fkey"
            columns: ["brandkit_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "job_queue_character_anchor_id_fkey"
            columns: ["character_anchor_id"]
            isOneToOne: false
            referencedRelation: "identity_anchors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sets: {
        Row: {
          brand_id: string
          constraints: Json | null
          created_at: string
          id: string
          master_seed: string | null
          request_text: string
          status: string
          style_ref_asset_id: string | null
          style_ref_url: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          constraints?: Json | null
          created_at?: string
          id?: string
          master_seed?: string | null
          request_text: string
          status?: string
          style_ref_asset_id?: string | null
          style_ref_url?: string | null
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          constraints?: Json | null
          created_at?: string
          id?: string
          master_seed?: string | null
          request_text?: string
          status?: string
          style_ref_asset_id?: string | null
          style_ref_url?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_sets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "job_sets_style_ref_asset_id_fkey"
            columns: ["style_ref_asset_id"]
            isOneToOne: false
            referencedRelation: "media_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_steps: {
        Row: {
          attempt: number
          created_at: string
          ended_at: string | null
          error: string | null
          id: string
          input_json: Json | null
          job_id: string
          max_attempts: number
          output_json: Json | null
          started_at: string | null
          status: string
          step_index: number
          step_type: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          ended_at?: string | null
          error?: string | null
          id?: string
          input_json?: Json | null
          job_id: string
          max_attempts?: number
          output_json?: Json | null
          started_at?: string | null
          status?: string
          step_index?: number
          step_type: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          ended_at?: string | null
          error?: string | null
          id?: string
          input_json?: Json | null
          job_id?: string
          max_attempts?: number
          output_json?: Json | null
          started_at?: string | null
          status?: string
          step_index?: number
          step_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          asset_id: string | null
          brand_snapshot: Json
          coherence_threshold: number | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          index_in_set: number
          job_set_id: string
          metadata: Json | null
          prompt: string
          retry_count: number | null
          slide_template: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          asset_id?: string | null
          brand_snapshot: Json
          coherence_threshold?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          index_in_set: number
          job_set_id: string
          metadata?: Json | null
          prompt: string
          retry_count?: number | null
          slide_template?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          asset_id?: string | null
          brand_snapshot?: Json
          coherence_threshold?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          index_in_set?: number
          job_set_id?: string
          metadata?: Json | null
          prompt?: string
          retry_count?: number | null
          slide_template?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_job_set_id_fkey"
            columns: ["job_set_id"]
            isOneToOne: false
            referencedRelation: "job_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string | null
          email: string
          generation_count: number | null
          id: string
          intent: Json | null
          ip_address: string | null
          last_generation_at: string | null
          last_seen_at: string | null
          marketing_opt_in: boolean | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          generation_count?: number | null
          id?: string
          intent?: Json | null
          ip_address?: string | null
          last_generation_at?: string | null
          last_seen_at?: string | null
          marketing_opt_in?: boolean | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          generation_count?: number | null
          id?: string
          intent?: Json | null
          ip_address?: string | null
          last_generation_at?: string | null
          last_seen_at?: string | null
          marketing_opt_in?: boolean | null
          source?: string | null
        }
        Relationships: []
      }
      library_assets: {
        Row: {
          brand_id: string | null
          campaign: string | null
          carousel_id: string | null
          cloudinary_public_id: string | null
          cloudinary_url: string
          created_at: string | null
          format: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          order_item_id: string | null
          slide_index: number | null
          tags: string[] | null
          text_json: Json | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          campaign?: string | null
          carousel_id?: string | null
          cloudinary_public_id?: string | null
          cloudinary_url: string
          created_at?: string | null
          format?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          order_item_id?: string | null
          slide_index?: number | null
          tags?: string[] | null
          text_json?: Json | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          campaign?: string | null
          carousel_id?: string | null
          cloudinary_public_id?: string | null
          cloudinary_url?: string
          created_at?: string | null
          format?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          order_item_id?: string | null
          slide_index?: number | null
          tags?: string[] | null
          text_json?: Json | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "library_assets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_assets_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      media_generations: {
        Row: {
          brand_id: string
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
          is_intermediate: boolean | null
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
          brand_id: string
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
          is_intermediate?: boolean | null
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
          brand_id?: string
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
          is_intermediate?: boolean | null
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
            foreignKeyName: "media_generations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
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
      order_items: {
        Row: {
          brief_json: Json
          created_at: string | null
          error_message: string | null
          id: string
          order_id: string
          sequence_number: number
          status: string
          text_json: Json | null
          type: string
          updated_at: string | null
        }
        Insert: {
          brief_json?: Json
          created_at?: string | null
          error_message?: string | null
          id?: string
          order_id: string
          sequence_number: number
          status?: string
          text_json?: Json | null
          type: string
          updated_at?: string | null
        }
        Update: {
          brief_json?: Json
          created_at?: string | null
          error_message?: string | null
          id?: string
          order_id?: string
          sequence_number?: number
          status?: string
          text_json?: Json | null
          type?: string
          updated_at?: string | null
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
          brand_id: string | null
          brief_json: Json
          campaign_name: string
          canva_url: string | null
          created_at: string | null
          customer_email: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          status: string
          updated_at: string | null
          user_id: string
          zip_url: string | null
        }
        Insert: {
          brand_id?: string | null
          brief_json?: Json
          campaign_name: string
          canva_url?: string | null
          created_at?: string | null
          customer_email?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          status?: string
          updated_at?: string | null
          user_id: string
          zip_url?: string | null
        }
        Update: {
          brand_id?: string | null
          brief_json?: Json
          campaign_name?: string
          canva_url?: string | null
          created_at?: string | null
          customer_email?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          status?: string
          updated_at?: string | null
          user_id?: string
          zip_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_requests: {
        Row: {
          created_at: string | null
          email: string
          id: string
          ip_address: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
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
          status: string | null
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
          status?: string | null
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
          status?: string | null
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
          {
            foreignKeyName: "profiles_active_brand_id_fkey"
            columns: ["active_brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
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
      subject_packs: {
        Row: {
          anchor_a_url: string | null
          anchor_b_url: string | null
          brand_id: string | null
          constraints_json: Json | null
          created_at: string | null
          id: string
          identity_prompt: string | null
          master_image_url: string
          name: string
          negative_prompt: string | null
          pack_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          anchor_a_url?: string | null
          anchor_b_url?: string | null
          brand_id?: string | null
          constraints_json?: Json | null
          created_at?: string | null
          id?: string
          identity_prompt?: string | null
          master_image_url: string
          name: string
          negative_prompt?: string | null
          pack_type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          anchor_a_url?: string | null
          anchor_b_url?: string | null
          brand_id?: string | null
          constraints_json?: Json | null
          created_at?: string | null
          id?: string
          identity_prompt?: string | null
          master_image_url?: string
          name?: string
          negative_prompt?: string | null
          pack_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_packs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_packs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
        ]
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
            foreignKeyName: "usage_event_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
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
      user_badges: {
        Row: {
          badge: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
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
      video_batches: {
        Row: {
          brand_id: string | null
          created_at: string
          error: string | null
          id: string
          input_prompt: string
          settings: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_prompt: string
          settings?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_prompt?: string
          settings?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_batches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_batches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      video_project_audio: {
        Row: {
          created_at: string
          id: string
          lufs_measured: number | null
          project_id: string
          source: string
          type: string
          url: string
          volume_percent: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          lufs_measured?: number | null
          project_id: string
          source?: string
          type: string
          url: string
          volume_percent?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          lufs_measured?: number | null
          project_id?: string
          source?: string
          type?: string
          url?: string
          volume_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_project_audio_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      video_project_clips: {
        Row: {
          clip_index: number
          created_at: string
          duration_sec: number | null
          error: string | null
          id: string
          project_id: string
          prompt: string | null
          status: string
          updated_at: string
          veo_job_id: string | null
          video_url_muted: string | null
          video_url_raw: string | null
        }
        Insert: {
          clip_index: number
          created_at?: string
          duration_sec?: number | null
          error?: string | null
          id?: string
          project_id: string
          prompt?: string | null
          status?: string
          updated_at?: string
          veo_job_id?: string | null
          video_url_muted?: string | null
          video_url_raw?: string | null
        }
        Update: {
          clip_index?: number
          created_at?: string
          duration_sec?: number | null
          error?: string | null
          id?: string
          project_id?: string
          prompt?: string | null
          status?: string
          updated_at?: string
          veo_job_id?: string | null
          video_url_muted?: string | null
          video_url_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_project_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      video_project_renders: {
        Row: {
          audio_mix_hash: string | null
          audio_mixed_at: string | null
          created_at: string
          error: string | null
          final_video_url: string | null
          id: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          audio_mix_hash?: string | null
          audio_mixed_at?: string | null
          created_at?: string
          error?: string | null
          final_video_url?: string | null
          id?: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          audio_mix_hash?: string | null
          audio_mixed_at?: string | null
          created_at?: string
          error?: string | null
          final_video_url?: string | null
          id?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_project_renders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      video_projects: {
        Row: {
          anchor_face_image_url: string | null
          anchor_set_image_url: string | null
          anchor_style_text: string | null
          brand_id: string | null
          created_at: string
          ducking_enabled: boolean
          id: string
          mode: string
          music_volume: number
          ratio: string
          style_preset_id: string | null
          updated_at: string
          user_id: string
          voice_lufs_target: number
        }
        Insert: {
          anchor_face_image_url?: string | null
          anchor_set_image_url?: string | null
          anchor_style_text?: string | null
          brand_id?: string | null
          created_at?: string
          ducking_enabled?: boolean
          id?: string
          mode?: string
          music_volume?: number
          ratio?: string
          style_preset_id?: string | null
          updated_at?: string
          user_id: string
          voice_lufs_target?: number
        }
        Update: {
          anchor_face_image_url?: string | null
          anchor_set_image_url?: string | null
          anchor_style_text?: string | null
          brand_id?: string | null
          created_at?: string
          ducking_enabled?: boolean
          id?: string
          mode?: string
          music_volume?: number
          ratio?: string
          style_preset_id?: string | null
          updated_at?: string
          user_id?: string
          voice_lufs_target?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_projects_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_projects_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      video_renders: {
        Row: {
          aspect_ratio: string | null
          brand_id: string | null
          cloudinary_audio_id: string | null
          cloudinary_base_id: string | null
          cloudinary_final_id: string | null
          cloudinary_final_url: string | null
          created_at: string | null
          duration_seconds: number | null
          error: string | null
          error_step: string | null
          id: string
          order_id: string | null
          overlay_spec: Json | null
          reference_cloudinary_id: string | null
          reference_image_url: string | null
          srt: string | null
          status: string
          updated_at: string | null
          user_id: string
          veo_base_url: string | null
          veo_operation: string | null
          visual_prompt: string
          visual_prompt_en: string | null
          voiceover_text: string | null
          with_audio: boolean | null
        }
        Insert: {
          aspect_ratio?: string | null
          brand_id?: string | null
          cloudinary_audio_id?: string | null
          cloudinary_base_id?: string | null
          cloudinary_final_id?: string | null
          cloudinary_final_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error?: string | null
          error_step?: string | null
          id?: string
          order_id?: string | null
          overlay_spec?: Json | null
          reference_cloudinary_id?: string | null
          reference_image_url?: string | null
          srt?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          veo_base_url?: string | null
          veo_operation?: string | null
          visual_prompt: string
          visual_prompt_en?: string | null
          voiceover_text?: string | null
          with_audio?: boolean | null
        }
        Update: {
          aspect_ratio?: string | null
          brand_id?: string | null
          cloudinary_audio_id?: string | null
          cloudinary_base_id?: string | null
          cloudinary_final_id?: string | null
          cloudinary_final_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error?: string | null
          error_step?: string | null
          id?: string
          order_id?: string | null
          overlay_spec?: Json | null
          reference_cloudinary_id?: string | null
          reference_image_url?: string | null
          srt?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          veo_base_url?: string | null
          veo_operation?: string | null
          visual_prompt?: string
          visual_prompt_en?: string | null
          voiceover_text?: string | null
          with_audio?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "video_renders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_renders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
          },
        ]
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
          {
            foreignKeyName: "videos_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brand_quota_current"
            referencedColumns: ["brand_id"]
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
      library_assets_view: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string | null
          metadata: Json | null
          thumb_url: string | null
          type: string | null
          url: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_brand_quota_current: {
        Row: {
          brand_id: string | null
          images_usage_pct: number | null
          images_used: number | null
          name: string | null
          plan: string | null
          quota_images: number | null
          quota_videos: number | null
          quota_woofs: number | null
          resets_on: string | null
          user_id: string | null
          videos_usage_pct: number | null
          videos_used: number | null
          woofs_usage_pct: number | null
          woofs_used: number | null
        }
        Insert: {
          brand_id?: string | null
          images_usage_pct?: never
          images_used?: number | null
          name?: string | null
          plan?: string | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          resets_on?: string | null
          user_id?: string | null
          videos_usage_pct?: never
          videos_used?: number | null
          woofs_usage_pct?: never
          woofs_used?: number | null
        }
        Update: {
          brand_id?: string | null
          images_usage_pct?: never
          images_used?: number | null
          name?: string | null
          plan?: string | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          resets_on?: string | null
          user_id?: string | null
          videos_usage_pct?: never
          videos_used?: number | null
          woofs_usage_pct?: never
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
      v_unified_assets: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string | null
          job_set_id: string | null
          meta: Json | null
          output_url: string | null
          type: string | null
        }
        Relationships: []
      }
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
      check_db_size_alert: { Args: never; Returns: undefined }
      claim_next_job: {
        Args: never
        Returns: {
          id: string
          order_id: string
          payload: Json
          type: string
          user_id: string
        }[]
      }
      claim_next_step: {
        Args: { p_job_id?: string }
        Returns: {
          input_json: Json
          job_id: string
          step_id: string
          step_index: number
          step_type: string
        }[]
      }
      cleanup_expired_assets: { Args: never; Returns: undefined }
      cleanup_old_password_reset_requests: { Args: never; Returns: undefined }
      complete_step_and_queue_next: {
        Args: { p_output_json?: Json; p_step_id: string }
        Returns: boolean
      }
      consume_visuals: {
        Args: {
          brand_id_param: string
          user_id_param: string
          visuals_amount: number
        }
        Returns: boolean
      }
      consume_woofs: {
        Args: { user_id_param: string; woofs_amount: number }
        Returns: boolean
      }
      decrement_monthly_counters: {
        Args: {
          p_brand_id: string
          p_images?: number
          p_period_yyyymm: number
          p_reels?: number
          p_woofs?: number
        }
        Returns: undefined
      }
      fail_step: {
        Args: { p_error: string; p_step_id: string }
        Returns: string
      }
      generate_affiliate_slug: {
        Args: { affiliate_id: string; affiliate_name: string }
        Returns: string
      }
      generate_short_job_id: { Args: never; Returns: string }
      get_table_sizes: {
        Args: never
        Returns: {
          row_count: number
          table_name: string
          total_size: string
          total_size_bytes: number
        }[]
      }
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
      recover_stuck_steps: { Args: never; Returns: number }
      refund_brand_quotas: {
        Args: {
          p_brand_id: string
          p_reels_count?: number
          p_visuals_count?: number
          p_woofs_count?: number
        }
        Returns: boolean
      }
      refund_woofs: {
        Args: { user_id_param: string; woofs_amount: number }
        Returns: boolean
      }
      reserve_brand_quotas: {
        Args: {
          p_brand_id: string
          p_reels_count?: number
          p_visuals_count?: number
          p_woofs_count?: number
        }
        Returns: {
          reason: string
          success: boolean
        }[]
      }
      reset_stuck_jobs: {
        Args: { age_minutes?: number }
        Returns: {
          reset_count: number
        }[]
      }
      update_affiliate_status: {
        Args: { affiliate_id_param: string }
        Returns: undefined
      }
      user_has_access: { Args: { user_id_param: string }; Returns: boolean }
    }
    Enums: {
      app_role: "user" | "admin" | "affiliate" | "vip" | "ambassadeur"
      asset_engine: "nano" | "sora" | "veo3"
      brand_plan: "starter" | "pro" | "studio"
      plan_type: "starter" | "pro" | "studio"
      video_engine: "sora" | "seededance" | "kling" | "replicate" | "veo_3_1"
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
      app_role: ["user", "admin", "affiliate", "vip", "ambassadeur"],
      asset_engine: ["nano", "sora", "veo3"],
      brand_plan: ["starter", "pro", "studio"],
      plan_type: ["starter", "pro", "studio"],
      video_engine: ["sora", "seededance", "kling", "replicate", "veo_3_1"],
    },
  },
} as const
