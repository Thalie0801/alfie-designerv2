// Temporary wrapper to debug env loading issues
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gbuvtzqqzyiytypenzae.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdidXZ0enFxenlpeXR5cGVuemFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMjMzMTUsImV4cCI6MjA3OTc5OTMxNX0.xyvFRRdslTbclDsfBBECUEcwXVjyBT2qoKpxHpb_kCo';

console.log('[Supabase] Initializing with:', { 
  url: SUPABASE_URL,
  hasKey: !!SUPABASE_PUBLISHABLE_KEY,
  envVars: {
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'present' : 'missing'
  }
});

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
