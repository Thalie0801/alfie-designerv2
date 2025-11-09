import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function consumeBrandQuotas(
  brandId: string, 
  imageCount: number = 1,  // ✅ Nombre d'images générées (1 par défaut, N pour carrousels)
  addVideos = 0, 
  addWoofs = 0
) {
  // Calculer la période actuelle YYYYMM (ex: 202510 pour octobre 2025)
  const now = new Date();
  const period = parseInt(
    now.getFullYear().toString() + 
    (now.getMonth() + 1).toString().padStart(2, '0')
  );
  
  console.log(`📊 [consumeBrandQuotas] Brand ${brandId} - Images: ${imageCount}, Reels: ${addVideos}, Woofs: ${addWoofs}`);
  
  // Utiliser increment_monthly_counters qui existe déjà
  const { data, error } = await admin.rpc("increment_monthly_counters", {
    p_brand_id: brandId,
    p_period_yyyymm: period,
    p_images: imageCount,     // ✅ Utiliser le paramètre (peut être 5 pour un carrousel de 5 slides)
    p_reels: addVideos,
    p_woofs: addWoofs,
  });
  
  if (error) throw new Error(error.message);
  
  console.log(`✅ [consumeBrandQuotas] Quota consumed successfully`);
  return true;
}
