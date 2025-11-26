// src/config/env.ts
/**
 * 🎯 Projet Supabase de référence pour Alfie Designer (Lovable Cloud) : itsjonazifiiikozengd
 * Ce projet est le seul backend officiel pour cette application.
 */

const env = typeof import.meta !== "undefined" ? import.meta.env : ({} as any);

// 🔐 URL du projet Supabase itsjonazifiiikozengd
export const SUPABASE_URL =
  env.VITE_SUPABASE_URL || 
  env.PUBLIC_SUPABASE_URL || 
  env.ALFIE_SUPABASE_URL ||
  "https://itsjonazifiiikozengd.supabase.co";

// 🔐 Clé ANON publique du projet itsjonazifiiikozengd
export const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.PUBLIC_SUPABASE_ANON_KEY ||
  env.ALFIE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0c2pvbmF6aWZpaWlrb3plbmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MzE3MzcsImV4cCI6MjA3NTIwNzczN30.s5aKKp_MrX8Tks2m7YUmDcp0bcSzo7s2Od2cyjU0n48";

// ✅ Log de diagnostic au démarrage
console.log("[Alfie] 🎯 SUPABASE_URL =", SUPABASE_URL);
console.log("[Alfie] 🎯 Project =", SUPABASE_URL.includes("itsjon") ? "itsjonazifiiikozengd ✅" : "AUTRE ❌");
console.log("[Alfie] SUPABASE_ANON_KEY prefix =", SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 10) : "(manquante)");
