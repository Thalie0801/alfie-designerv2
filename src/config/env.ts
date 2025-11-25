// src/config/env.ts

const env = typeof import.meta !== "undefined" ? import.meta.env : ({} as any);

// 🔐 URL du NOUVEAU projet Supabase
export const SUPABASE_URL =
  env.VITE_SUPABASE_URL || env.PUBLIC_SUPABASE_URL || "https://onxqgtuiagiuomlstcmt.supabase.co";

// 🔐 Clé ANON publique du NOUVEAU projet
export const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.PUBLIC_SUPABASE_ANON_KEY ||
  // ⬇️ Mets ICI la clé "anon public" copiée depuis Supabase
  "sb_publishable_Mt85r7sZTewTZb__-tCB4w_p2e8lOUl";

// ✅ Ne jette plus d'erreur bloquante si Lovable n’injecte pas les VITE_*
if (!env.VITE_SUPABASE_ANON_KEY && !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn("[Alfie] SUPABASE_ANON_KEY absente dans import.meta.env – on utilise le fallback hardcodé.");
}

console.log("[Alfie] SUPABASE_URL =", SUPABASE_URL);
console.log("[Alfie] SUPABASE_ANON_KEY prefix =", SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 10) : "(manquante)");
