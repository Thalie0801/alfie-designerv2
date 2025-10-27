import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function consumeBrandQuotas(brandId: string, addVideos = 0, addWoofs = 0) {
  const { data, error } = await admin.rpc("increment_brand_usage", {
    p_brand_id: brandId,
    p_videos: addVideos,
    p_woofs: addWoofs,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Quota insuffisant");
  return true;
}
