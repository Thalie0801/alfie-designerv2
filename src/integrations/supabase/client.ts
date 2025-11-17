import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error("VITE_SUPABASE_URL n'est pas configuré");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("VITE_SUPABASE_ANON_KEY n'est pas configuré");
}
// ⚠️ Remplace par TES vraies valeurs (Project URL + anon public)
const SUPABASE_URL = "https://itsjonazifiiikozengd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueHFndHVpYWdpdW9tbHN0Y210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyODQyMTMsImV4cCI6MjA3Njg2MDIxM30.qbAeZK7WBIQFAm4FOgeuff_q_00r1sKm5_nf-KclD8I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
