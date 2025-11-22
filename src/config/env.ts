// src/config/env.ts

// ✅ Fallbacks vers le projet Supabase onx
const FALLBACK_SUPABASE_URL = 'https://onxqgtuiagiuomlstcmt.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueHFndHVpYWdpdW9tbHN0Y210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MzE3MzcsImV4cCI6MjA3NTIwNzczN30.EdzpwyX-2BnwKRqIA9_hwFp1oCkMT4AElPn6dN1Dvy8';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

// ❌ IMPORTANT : plus aucun throw ici, on ne fait que log si problème
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('[env] Using fallback Supabase config (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set).');
}

export const env = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
};
