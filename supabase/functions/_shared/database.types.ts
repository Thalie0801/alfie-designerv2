export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          plan: string | null
          quota_brands: number | null
          quota_images: number | null
          quota_videos: number | null
          quota_woofs: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: string | null
          [key: string]: any
        }
        Insert: {
          id: string
          email: string
          plan?: string | null
          quota_brands?: number | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string | null
          [key: string]: any
        }
        Update: {
          id?: string
          email?: string
          plan?: string | null
          quota_brands?: number | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string | null
          [key: string]: any
        }
      }
      payment_sessions: {
        Row: {
          session_id: string
          email: string
          plan: string
          verified: boolean
          amount: number
          [key: string]: any
        }
        Insert: {
          session_id: string
          email: string
          plan: string
          verified?: boolean
          amount?: number
          [key: string]: any
        }
        Update: {
          session_id?: string
          email?: string
          plan?: string
          verified?: boolean
          amount?: number
          [key: string]: any
        }
      }
      affiliate_conversions: {
        Row: {
          id: string
          affiliate_id: string
          user_id: string
          plan: string
          amount: number
          status: string | null
          [key: string]: any
        }
        Insert: {
          affiliate_id: string
          user_id: string
          plan: string
          amount: number
          status?: string | null
          [key: string]: any
        }
        Update: {
          id?: string
          affiliate_id?: string
          user_id?: string
          plan?: string
          amount?: number
          status?: string | null
          [key: string]: any
        }
      }
      affiliates: {
        Row: {
          id: string
          email: string
          name: string
          status: string | null
          [key: string]: any
        }
        Insert: {
          id?: string
          email: string
          name: string
          status?: string | null
          [key: string]: any
        }
        Update: {
          id?: string
          email?: string
          name?: string
          status?: string | null
          [key: string]: any
        }
      }
      brands: {
        Row: {
          id: string
          user_id: string
          name: string
          plan: string | null
          is_addon: boolean | null
          quota_images: number | null
          quota_videos: number | null
          quota_woofs: number | null
          stripe_subscription_id: string | null
          [key: string]: any
        }
        Insert: {
          user_id: string
          name: string
          plan?: string | null
          is_addon?: boolean | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          stripe_subscription_id?: string | null
          [key: string]: any
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          plan?: string | null
          is_addon?: boolean | null
          quota_images?: number | null
          quota_videos?: number | null
          quota_woofs?: number | null
          stripe_subscription_id?: string | null
          [key: string]: any
        }
      }
      [key: string]: any
    }
    Functions: {
      calculate_mlm_commissions: {
        Args: {
          conversion_id_param: string
          direct_affiliate_id: string
          conversion_amount: number
        }
        Returns: void
      }
      update_affiliate_status: {
        Args: {
          affiliate_id_param: string
        }
        Returns: void
      }
      [key: string]: any
    }
  }
}
