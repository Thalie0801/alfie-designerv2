import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, env } from "./env.ts";

export async function userHasAccess(authHeader: string | null) {
  const ENFORCE = (env("AUTH_ENFORCEMENT") ?? "on").toLowerCase() === "on";
  if (!ENFORCE) return true;

  const client = createClient(
    SUPABASE_URL ?? "",
    SUPABASE_ANON_KEY ?? "",
    { global: { headers: { Authorization: authHeader ?? "" } } }
  );

  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;

  // Check VIP/ADMIN status via database roles
  const { data: roles } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  
  const userRoles = (roles || []).map(r => r.role);
  const isVip = userRoles.includes('vip');
  const isAdmin = userRoles.includes('admin');
  
  // Log diagnostic pour debug
  console.log(`[AccessControl] Checking access for: ${user.email} | Roles: ${userRoles.join(',')} | isVip: ${isVip} | isAdmin: ${isAdmin}`);
  
  if (isVip || isAdmin) {
    console.log(`[AccessControl] ✅ Access granted via ${isVip ? 'VIP' : 'ADMIN'} role from database`);
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
