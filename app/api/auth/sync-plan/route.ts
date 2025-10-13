import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ACTIVE_PLAN_COOKIE = "hasActivePlan";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST() {
  try {
    const { client, accessToken } = createServerClient();
    if (!accessToken) {
      cookies().set(ACTIVE_PLAN_COOKIE, "0", { path: "/", maxAge: COOKIE_MAX_AGE });
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) {
      cookies().set(ACTIVE_PLAN_COOKIE, "0", { path: "/", maxAge: COOKIE_MAX_AGE });
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }

    const { data: profile } = await client
      .from("profiles")
      .select("plan")
      .eq("id", data.user.id)
      .maybeSingle();

    const hasPlan = Boolean(profile?.plan);
    cookies().set(ACTIVE_PLAN_COOKIE, hasPlan ? "1" : "0", { path: "/", maxAge: COOKIE_MAX_AGE });

    return NextResponse.json({ ok: true, hasPlan });
  } catch (error) {
    console.error("[api/auth/sync-plan]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
