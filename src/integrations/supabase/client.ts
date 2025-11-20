import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/env";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/env";

// DEBUG TEMPORAIRE
console.log("[Alfie] SUPABASE_URL =", SUPABASE_URL);
console.log("[Alfie] SUPABASE_ANON_KEY prefix =", SUPABASE_ANON_KEY?.slice(0, 12));

if (!SUPABASE_URL) {
  throw new Error("VITE_SUPABASE_URL n'est pas configuré");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("VITE_SUPABASE_ANON_KEY n'est pas configuré");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
