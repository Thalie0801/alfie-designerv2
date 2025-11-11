import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function loadChatContext(userId: string, brandId: string) {
  const { data } = await admin
    .from('chat_sessions')
    .select('context')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .order('last_interaction', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.context || {};
}

export async function saveChatContext(userId: string, brandId: string, context: any) {
  await admin
    .from('chat_sessions')
    .upsert({
      user_id: userId,
      brand_id: brandId,
      context,
      last_interaction: new Date().toISOString()
    }, {
      onConflict: 'user_id,brand_id'
    });
}
