// src/config/env.ts
// Config Supabase pour le FRONT (React / Vite)

type RuntimeEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
} & Record<string, string>;

// On récupère ce qu'on peut : import.meta.env en Vite, sinon un fallback global
const rawEnv: RuntimeEnv =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? ((import.meta as any).env as RuntimeEnv)
    : (((globalThis as any).ENV ?? {}) as RuntimeEnv);

// ✅ URL Supabase : env → fallback nouveau projet
export const SUPABASE_URL =
  rawEnv.VITE_SUPABASE_URL || rawEnv.PUBLIC_SUPABASE_URL || "https://onxqgtuiagiuomlstcmt.supabase.co"; // <- ton NOUVEAU projet

// ✅ Clé anonyme (publishable) : plusieurs noms possibles → fallback hardcodé
export const SUPABASE_ANON_KEY =
  rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  rawEnv.VITE_SUPABASE_ANON_KEY ||
  rawEnv.PUBLIC_SUPABASE_ANON_KEY ||
  "sb-pub-REMPLACE_MOI"; // <--- METS ICI TA CLÉ sb-pub-... du nouveau projet

// On log, mais on NE JETTE PLUS D'ERREUR
if (!rawEnv.VITE_SUPABASE_ANON_KEY && !rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn("[Alfie] SUPABASE_ANON_KEY absente dans import.meta.env – utilisation du fallback codé en dur.");
}

console.log("[Alfie] SUPABASE_URL =", SUPABASE_URL);
console.log("[Alfie] SUPABASE_ANON_KEY prefix =", SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 10) : "(manquante)");
