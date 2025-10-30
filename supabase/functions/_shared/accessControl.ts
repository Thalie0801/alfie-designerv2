import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export async function userHasAccess(authHeader: string | null) {
  const ENFORCE = (Deno.env.get("AUTH_ENFORCEMENT") ?? "on").toLowerCase() === "on";
  if (!ENFORCE) return true;

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader ?? "" } } }
  );

  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;

  // Check VIP status
  const vipEmails = (Deno.env.get("VIP_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  
  if (vipEmails.includes(user.email?.toLowerCase() ?? "")) {
    return true;
  }

  // Check ADMIN status
  const adminEmails = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  
  if (adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    return true;
  }

  // Check regular subscription
  const { data: profile } = await client
    .from("profiles")
    .select("plan, granted_by_admin, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!profile) return false;

  const paid = !!profile.stripe_subscription_id;
  const granted = !!profile.granted_by_admin;
  const planOk = !!profile.plan;

  return paid || granted || planOk;
}
