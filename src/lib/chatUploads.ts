import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadToChatBucket(
  file: File,
  supabase: SupabaseClient,
  userId: string,
) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const filePath = `${userId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-uploads")
    .upload(filePath, file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;

  // ✅ Use getPublicUrl for permanent URLs (bucket is public)
  const { data } = supabase.storage.from("chat-uploads").getPublicUrl(filePath);

  return { publicUrl: data.publicUrl, path: filePath };
}
