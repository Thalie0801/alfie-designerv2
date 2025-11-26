import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../config/env";

// On met des valeurs de secours si jamais les env ne sont pas définies.
// Ça évite les erreurs de typage et les crashs de preview.
// Si les vraies VITE_SUPABASE_* sont bien set (ce qui est ton cas),
// ce sont elles qui seront utilisées.
const url = SUPABASE_URL || "https://itsjonazifiiikozengd.supabase.co";
const key = SUPABASE_ANON_KEY || "public-anon-key-placeholder";

if (!SUPABASE_ANON_KEY) {
  console.warn(
    "[Alfie] SUPABASE_ANON_KEY absente dans import.meta.env – les appels Supabase peuvent échouer, mais la preview reste accessible.",
  );
}

export const supabase = createClient(url, key);

export default supabase;
