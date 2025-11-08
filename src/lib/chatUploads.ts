import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadToChatBucket(
  file: File,
  supabase: SupabaseClient,
  userId: string,
) {
  const ext = file.name.split('.').pop() || 'bin';
  const filePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-uploads")
    .upload(filePath, file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;

  const signed = await supabase.storage.from("chat-uploads").createSignedUrl(filePath, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) {
    throw signed.error ?? new Error("createSignedUrl failed");
  }

  return { signedUrl: signed.data.signedUrl, path: filePath };
}
