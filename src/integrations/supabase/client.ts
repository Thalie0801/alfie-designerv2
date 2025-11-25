import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../config/env";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[Alfie] SUPABASE_ANON_KEY absente – le client Supabase ne sera pas initialisé (mais la preview reste accessible).",
  );
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default supabase;
