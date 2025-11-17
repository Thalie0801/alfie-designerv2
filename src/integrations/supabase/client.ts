import { createClient } from "@supabase/supabase-js";

// ⚠️ Remplace par TES vraies valeurs (Project URL + anon public)
const SUPABASE_URL = "https://itsjonazifiiikozengd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueHFndHVpYWdpdW9tbHN0Y210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyODQyMTMsImV4cCI6MjA3Njg2MDIxM30.qbAeZK7WBIQFAm4FOgeuff_q_00r1sKm5_nf-KclD8I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
