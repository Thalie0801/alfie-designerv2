import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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
