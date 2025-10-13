import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/app",
  "/templates",
  "/library",
  "/dashboard",
  "/profile",
  "/affiliate",
];

const PLAN_REQUIRED_PREFIXES = ["/app", "/templates", "/library", "/dashboard", "/profile", "/affiliate"];

// Exclut les assets Next et tout /api/health*
export const config = { matcher: ["/((?!_next|static|api/health*).*)"] };

const ACTIVE_PLAN_COOKIE = "hasActivePlan";
const ROLE_COOKIE = "appRole";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

function shouldProtectPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function requiresPlan(pathname: string) {
  return PLAN_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function buildNextValue(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  return `${pathname}${search}`;
}

function redirectTo(path: string, req: NextRequest) {
  const nextUrl = req.nextUrl.clone();
  nextUrl.pathname = path;
  nextUrl.searchParams.set("next", buildNextValue(req));
  return NextResponse.redirect(nextUrl);
}

export async function middleware(req: NextRequest) {
  // Ne bloque rien pendant le debug
  const bypass = req.nextUrl.searchParams.get("bypass") === "1" || process.env.DISABLE_MW === "true";
  if (bypass) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (!shouldProtectPath(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  try {
    const { client, accessToken } = createMiddlewareClient(req, response);

    if (!accessToken) {
      return redirectTo("/auth/login", req);
    }

    const { data, error } = await client.auth.getUser(accessToken);

    if (error || !data.user) {
      return redirectTo("/auth/login", req);
    }

    const role = req.cookies.get(ROLE_COOKIE)?.value ?? "client";
    const isAdmin = role === "admin";

    if (!requiresPlan(pathname) || isAdmin) {
      response.cookies.set(ACTIVE_PLAN_COOKIE, "1", { path: "/", maxAge: COOKIE_MAX_AGE });
      return response;
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("plan")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[middleware] profile fetch error", profileError);
    }

    const hasPlan = Boolean(profile?.plan);

    response.cookies.set(ACTIVE_PLAN_COOKIE, hasPlan ? "1" : "0", {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    if (!hasPlan) {
      const redirectResponse = redirectTo("/billing", req);
      redirectResponse.cookies.set(ACTIVE_PLAN_COOKIE, "0", { path: "/", maxAge: COOKIE_MAX_AGE });
      return redirectResponse;
    }

    return response;
  } catch (error) {
    console.error("[middleware]", error);
    return response;
  }
}
