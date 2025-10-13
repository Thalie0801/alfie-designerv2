import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

export type AuthContext = {
  user: User;
  profile: {
    plan: string | null;
    stripe_subscription_id: string | null;
    quota_visuals_per_month: number | null;
    quota_videos: number | null;
  } | null;
};

const ACTIVE_PLAN_COOKIE = "hasActivePlan";

export async function requireUser(nextPath: string): Promise<{ user: User }> {
  const { client, accessToken } = createServerClient();
  if (!accessToken) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  const { data, error } = await client.auth.getUser(accessToken ?? undefined);
  if (error || !data.user) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  return { user: data.user };
}

export async function requireUserWithProfile(nextPath: string): Promise<{ user: User; profile: AuthContext["profile"] }> {
  const { client, accessToken } = createServerClient();
  if (!accessToken) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  const { data, error } = await client.auth.getUser(accessToken ?? undefined);
  if (error || !data.user) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("plan, stripe_subscription_id, quota_visuals_per_month, quota_videos")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[auth] profile fetch error", profileError);
  }

  if (!profile || !profile.plan) {
    cookies().set(ACTIVE_PLAN_COOKIE, "0", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    redirect(`/billing?next=${encodeURIComponent(nextPath)}`);
  }

  cookies().set(ACTIVE_PLAN_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 30 });

  return { user: data.user, profile };
}
