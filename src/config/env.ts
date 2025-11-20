// Centralized environment configuration for Alfie Designer
// Ensures we consistently read Supabase settings and log them once at startup

// Support both Vite runtime (import.meta.env) and Node/Deno (process.env)
// to avoid reference errors when this module is imported in scripts or tests.
// In Node ESM, import.meta exists but does not include "env", so we guard for it
// before falling back to process.env.
const runtimeEnv =
  typeof import.meta !== "undefined" && (import.meta as ImportMeta & { env?: unknown }).env
    ? (import.meta as ImportMeta).env
    : process.env;

const SUPABASE_URL = (runtimeEnv as Record<string, string | undefined>).VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (runtimeEnv as Record<string, string | undefined>).VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error("VITE_SUPABASE_URL n'est pas configuré");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("VITE_SUPABASE_ANON_KEY n'est pas configuré");
}

console.log("[Alfie] SUPABASE_URL =", SUPABASE_URL);
console.log(
  "[Alfie] SUPABASE_ANON_KEY prefix =",
  SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 10) : "(manquante)"
);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
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
