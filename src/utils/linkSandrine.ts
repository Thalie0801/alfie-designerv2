import { linkAffiliateToParent } from "@/lib/admin-link-affiliate";

// Script pour rattacher Sandrine sous Nathalie
export async function linkSandrineToNathalie() {
  console.log("Linking Sandrine to Nathalie...");
  
  const result = await linkAffiliateToParent(
    "sandrine.guedra54@gmail.com",
    "nathaliestaelens@gmail.com"
  );

  if (result.success) {
    console.log("✅ Sandrine successfully linked to Nathalie");
  } else {
    console.error("❌ Error linking Sandrine:", result.error);
  }

  return result;
}

// Auto-execute
linkSandrineToNathalie();
