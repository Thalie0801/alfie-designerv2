import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS } from "../env.ts";

import { corsHeaders } from "../cors.ts";
export const supabaseAdmin = () =>
  createClient(
    SUPABASE_URL ?? "",
    SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export const supabaseUserFromReq = (req: Request) =>
  createClient(
    SUPABASE_URL ?? "",
    SUPABASE_ANON_KEY ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );

export async function getAuthUserId(req: Request): Promise<string | null> {
  const client = supabaseUserFromReq(req);
  const { data } = await client.auth.getUser();
  return data?.user?.id ?? null;
}

export async function assertIsAdmin(client: SupabaseClient, userId: string): Promise<boolean> {
  // 1) Email autorisé via env (priorité pour éviter dépendance RLS)
  const { data: { user } } = await client.auth.getUser();
  const userEmail = user?.email?.toLowerCase() || "";
  
  const admins = (ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  
  const byEmail = userEmail && admins.includes(userEmail);
  
  // 2) Rôle en BDD (check additionnel)
  const { data: roles } = await client.from("user_roles").select("role").eq("user_id", userId);
  const byRole = !!roles?.some((r) => r.role === "admin");

  // Log diagnostic
  console.log(`[AdminCheck] Checking admin for: ${userEmail} | byEmail: ${byEmail} | byRole: ${byRole} | ADMIN_EMAILS: ${admins.join(',')}`);
  
  const isAdmin = byEmail || byRole;
  if (isAdmin) {
    console.log(`[AdminCheck] ✅ Admin access granted via ${byEmail ? 'EMAIL' : 'ROLE'}`);
  }

  return isAdmin;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
