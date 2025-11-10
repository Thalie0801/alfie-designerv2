import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const authOptions: SupabaseClientOptions<Database>['auth'] = isBrowser
  ? {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    }
  : {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    };

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: authOptions,
});
