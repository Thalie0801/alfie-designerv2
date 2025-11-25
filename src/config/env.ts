// src/config/env.ts

const env = (typeof import.meta !== "undefined" ? import.meta.env : {}) as any;

// URL du projet Supabase
const SUPABASE_URL = env.VITE_SUPABASE_URL || env.PUBLIC_SUPABASE_URL || "https://onxqgtuiagiuomlstcmt.supabase.co";

// Clé "publique" (publishable / anon)
const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.PUBLIC_SUPABASE_ANON_KEY || "";

// ⚠️ On LOGUE mais on ne jette plus d’erreur fatale
if (!SUPABASE_ANON_KEY) {
  console.warn(
    "[Alfie] SUPABASE_ANON_KEY manquante dans import.meta.env – la preview va s'afficher mais Supabase ne pourra pas faire grand-chose.",
  );
}

console.log("[Alfie] SUPABASE_URL =", SUPABASE_URL);
console.log("[Alfie] SUPABASE_ANON_KEY prefix =", SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 10) : "(manquante)");

export const APP_SUPABASE_URL = SUPABASE_URL;
export const APP_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
