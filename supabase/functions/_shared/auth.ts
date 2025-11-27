import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { ADMIN_EMAILS } from "./env.ts";

function parseAdminEmails(): string[] {
  return (ADMIN_EMAILS ?? "")
    .split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
}

export type RoleRow = { role: string };

export type AdminCheckOptions = {
  roles?: RoleRow[] | null;
  plan?: string | null;
  grantedByAdmin?: boolean | null;
  logContext?: string;
  isAdminFlag?: boolean | null;
};

export function isAdminUser(
  email: string | null | undefined,
  roles: RoleRow[] | null = null,
  options: AdminCheckOptions = {},
): boolean {
  if (options.isAdminFlag) {
    if (options.logContext) {
      console.log(`[${options.logContext}] admin bypass applied for ${email || "unknown-email"} (explicit flag)`);
    }
    return true;
  }

  const adminEmails = parseAdminEmails();
  const normalizedEmail = (email || "").trim().toLowerCase();
  const normalizedRoles = options.roles ?? roles ?? null;

  const hasAdminRole = !!normalizedRoles?.some((r) => r.role === "admin");
  const isPlanAdmin = options.plan === "admin" || !!options.grantedByAdmin;
  const isAdmin =
    (!!normalizedEmail && adminEmails.includes(normalizedEmail)) ||
    hasAdminRole ||
    isPlanAdmin;

  if (isAdmin && options.logContext) {
    console.log(`[${options.logContext}] admin bypass applied for ${normalizedEmail || "unknown-email"}`);
  }

  return isAdmin;
}

export async function getUserRoles(client: SupabaseClient, userId: string) {
  const { data: roleRows, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("[auth] failed to fetch user roles", error);
    return null;
  }

  return roleRows ?? null;
}
