import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env.ts";

const admin = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function incrementMonthlyVisuals(profileId: string, delta = 1) {
  const { error } = await admin.rpc("increment_profile_visuals", {
    p_profile_id: profileId,
    p_delta: delta,
  });
  if (error) throw new Error(error.message);
  return true;
}
