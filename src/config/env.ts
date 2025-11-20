const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL is not configured (VITE_SUPABASE_URL).");
}

if (!supabaseAnonKey) {
  throw new Error(
    "Supabase anonymous key is not configured (VITE_SUPABASE_ANON_KEY)."
  );
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
