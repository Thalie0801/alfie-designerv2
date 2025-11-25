// Petit helper pour lire import.meta.env en douceur
const env = (typeof import.meta !== "undefined" ? import.meta.env : {}) as any;

export const SUPABASE_URL =
  env.VITE_SUPABASE_URL || env.PUBLIC_SUPABASE_URL || "https://onxqgtuiagiuomlstcmt.supabase.co";

export const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.PUBLIC_SUPABASE_ANON_KEY || "";

// On ne jette plus d'erreur, on log juste
if (!env.VITE_SUPABASE_ANON_KEY) {
  console.log(
    "[Alfie] SUPABASE_ANON_KEY absente dans import.meta.env – Supabase risque de ne pas marcher, mais la preview reste accessible.",
  );
}

console.log("[Alfie] SUPABASE_URL =", SUPABASE_URL);
console.log("[Alfie] SUPABASE_ANON_KEY prefix =", SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 10) : "(manquante)");
