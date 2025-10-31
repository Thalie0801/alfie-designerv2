import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function consumeBrandQuotas(brandId: string, addVideos = 0, addWoofs = 0) {
  // Calculer la période actuelle YYYYMM (ex: 202510 pour octobre 2025)
  const now = new Date();
  const period = parseInt(
    now.getFullYear().toString() + 
    (now.getMonth() + 1).toString().padStart(2, '0')
  );
  
  // Utiliser increment_monthly_counters qui existe déjà
  const { data, error } = await admin.rpc("increment_monthly_counters", {
    p_brand_id: brandId,
    p_period_yyyymm: period,
    p_images: 1,           // 1 image générée
    p_reels: addVideos,
    p_woofs: addWoofs,
  });
  
  if (error) throw new Error(error.message);
  return true;
}
