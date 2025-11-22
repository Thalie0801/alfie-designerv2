// src/config/env.ts

const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  // On LOG l'erreur au lieu de faire crasher toute l'app
  console.error('[Env] Variables Supabase manquantes', {
    hasUrl: !!VITE_SUPABASE_URL,
    hasAnonKey: !!VITE_SUPABASE_ANON_KEY,
  });
}

export const env = {
  VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY,
};
