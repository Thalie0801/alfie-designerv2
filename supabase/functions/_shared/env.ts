/**
 * Environment Variable Helper with Lovable VITE_ Compatibility
 *
 * Resolves environment variables with fallback support for Lovable's VITE_ prefix.
 * This allows Edge Functions to work seamlessly whether vars are prefixed or not.
 * 
 * 🎯 Projet Supabase de référence pour Alfie Designer (Lovable Cloud) : itsjonazifiiikozengd
 * Ce projet est le seul backend officiel pour cette application.
 */

/**
 * Resolve environment variable with multiple fallback keys
 * @param keys - List of keys to try in order
 * @returns The first non-empty value found, or undefined
 */
export function env(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && String(v).trim()) return v;
  }
  return undefined;
}

// ✅ Public variables (RLS client)
// Priorité aux secrets ALFIE_* (non gérés par Lovable),
// puis aux anciens noms si jamais ils existent encore,
// puis fallback sur l'URL du projet Supabase officiel itsjonazifiiikozengd.
export const SUPABASE_URL =
  env('SUPABASE_URL', 'VITE_SUPABASE_URL', 'ALFIE_SUPABASE_URL') ||
  'https://itsjonazifiiikozengd.supabase.co';

export const SUPABASE_ANON_KEY = env(
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'ALFIE_SUPABASE_ANON_KEY'
);

// ✅ Private secrets (service role, pas de VITE_ pour éviter les fuites)
export const SUPABASE_SERVICE_ROLE_KEY = env(
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE_KEY',
  'ALFIE_SUPABASE_SERVICE_ROLE_KEY'
);

export const INTERNAL_FN_SECRET = env('INTERNAL_FN_SECRET', 'INTERNAL_SECRET');

// ✅ API Keys and other secrets
export const LOVABLE_API_KEY = env('LOVABLE_API_KEY');
export const CLOUDINARY_CLOUD_NAME = env('CLOUDINARY_CLOUD_NAME');
export const CLOUDINARY_API_KEY = env('CLOUDINARY_API_KEY');
export const CLOUDINARY_API_SECRET = env('CLOUDINARY_API_SECRET');
export const REPLICATE_API_TOKEN = env('REPLICATE_API_TOKEN');
export const REPLICATE_API_KEY = env('REPLICATE_API_KEY', 'REPLICATE_API_TOKEN');
export const FFMPEG_BACKEND_URL = env('FFMPEG_BACKEND_URL');
export const FFMPEG_BACKEND_API_KEY = env('FFMPEG_BACKEND_API_KEY');
export const ALFIE_ADMIN_EMAILS = env('ALFIE_ADMIN_EMAILS');
export const ADMIN_EMAILS = env('ADMIN_EMAILS');
export const RESEND_API_KEY = env('RESEND_API_KEY');
export const STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY');

/**
 * Require an environment variable (throws if not found)
 * @param keys - List of keys to try
 * @returns The first non-empty value found
 * @throws Error if no value is found
 */
export function requireEnv(...keys: string[]): string {
  const value = env(...keys);
  if (!value) {
    throw new Error(`Missing required environment variable: ${keys.join(' or ')}`);
  }
  return value;
}

/**
 * Validate that all critical environment variables are present
 * @returns Object with validation results
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  const required: Array<[string, string | undefined]> = [
    ['SUPABASE_URL', SUPABASE_URL],
    ['SUPABASE_ANON_KEY', SUPABASE_ANON_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
  ];

  const missing = required
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return {
    valid: missing.length === 0,
    missing,
  };
}
