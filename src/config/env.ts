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

// CRITICAL FIX: Use PUBLISHABLE_KEY which contains the real JWT token
// The ANON_KEY in .env is a publishable token prefix, not the JWT
const supabaseUrl =
  (runtimeEnv as Record<string, string | undefined>).VITE_SUPABASE_URL ||
  (runtimeEnv as Record<string, string | undefined>).PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  (runtimeEnv as Record<string, string | undefined>).VITE_SUPABASE_PUBLISHABLE_KEY ||
  (runtimeEnv as Record<string, string | undefined>).VITE_SUPABASE_ANON_KEY ||
  (runtimeEnv as Record<string, string | undefined>).PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL n'est pas configuré");
}

if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY n'est pas configuré");
}

console.log("[Alfie] SUPABASE_URL =", supabaseUrl);
console.log(
  "[Alfie] SUPABASE_ANON_KEY prefix =",
  supabaseAnonKey ? supabaseAnonKey.slice(0, 10) : "(manquante)"
);

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
