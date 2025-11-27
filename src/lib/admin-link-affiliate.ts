import { supabase } from "@/lib/supabase";

export async function linkAffiliateToParent(
  affiliateEmail: string,
  parentEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("admin-link-affiliate", {
      body: {
        affiliate_email: affiliateEmail,
        parent_email: parentEmail,
      },
    });

    if (error) {
      console.error("[linkAffiliateToParent] Error:", error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[linkAffiliateToParent] Exception:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}
