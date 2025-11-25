// src/config/env.ts

// Sécurise l’accès à import.meta.env même côté sandbox Lovable
const rawEnv = typeof import.meta !== "undefined" ? (import.meta as any).env || {} : ({} as any);

// On laisse bien ces noms-là : SUPABASE_URL / SUPABASE_ANON_KEY
export const SUPABASE_URL =
  rawEnv.VITE_SUPABASE_URL ||
  rawEnv.PUBLIC_SUPABASE_URL ||
  // fallback : ton nouveau projet Supabase
  "https://onxqgtuiagiuomlstcmt.supabase.co";

export const SUPABASE_ANON_KEY =
  rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY || rawEnv.VITE_SUPABASE_ANON_KEY || rawEnv.PUBLIC_SUPABASE_ANON_KEY || "";

// ❌ On ne jette plus d’erreur fatale, sinon pas de preview
if (!SUPABASE_ANON_KEY) {
  console.warn(
    "[Alfie] SUPABASE_ANON_KEY absente dans import.meta.env – Supabase ne marchera pas, mais la preview reste accessible.",
  );
}

console.log("[Alfie] SUPABASE_URL =", SUPABASE_URL);
console.log("[Alfie] SUPABASE_ANON_KEY prefix =", SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 10) : "(manquante)");
