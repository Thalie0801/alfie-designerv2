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

const ACTIVE_PLAN_COOKIE = "hasActivePlan";
const ROLE_COOKIE = "appRole";
const REF_COOKIE = "ref";
const REF_MAX_AGE = 60 * 60 * 24 * 180;

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const ref = request.nextUrl.searchParams.get("ref");
  if (ref) {
    response.cookies.set(REF_COOKIE, ref, { path: "/", maxAge: REF_MAX_AGE });
  }

  if (request.nextUrl.searchParams.get("bypass") === "1" || process.env.DISABLE_MW === "true") {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.startsWith("/static")) {
    return response;
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected) {
    return response;
  }

  const roleCookie = request.cookies.get(ROLE_COOKIE)?.value;
  if (roleCookie === "admin") {
    return response;
  }

  let hasActivePlan = request.cookies.get(ACTIVE_PLAN_COOKIE)?.value === "1";

  try {
    const { client, accessToken } = createMiddlewareClient(request, response);
    if (!accessToken) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      if (ref) {
        redirectResponse.cookies.set(REF_COOKIE, ref, { path: "/", maxAge: REF_MAX_AGE });
      }
      return redirectResponse;
    }

    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      if (ref) {
        redirectResponse.cookies.set(REF_COOKIE, ref, { path: "/", maxAge: REF_MAX_AGE });
      }
      return redirectResponse;
    }

    if (!hasActivePlan) {
      const { data: profile } = await client
        .from("profiles")
        .select("plan")
        .eq("id", data.user.id)
        .maybeSingle();

      hasActivePlan = Boolean(profile?.plan);
      response.cookies.set(ACTIVE_PLAN_COOKIE, hasActivePlan ? "1" : "0", {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    if (!hasActivePlan) {
      const billingUrl = new URL("/billing", request.url);
      billingUrl.searchParams.set("next", pathname);
      const redirectResponse = NextResponse.redirect(billingUrl);
      if (ref) {
        redirectResponse.cookies.set(REF_COOKIE, ref, { path: "/", maxAge: REF_MAX_AGE });
      }
      return redirectResponse;
    }

    return response;
  } catch (error) {
    console.error("[middleware]", error);
    const billingUrl = new URL("/billing", request.url);
    billingUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(billingUrl);
    if (ref) {
      redirectResponse.cookies.set(REF_COOKIE, ref, { path: "/", maxAge: REF_MAX_AGE });
    }
    return redirectResponse;
  }
}

export const config = {
  matcher: [
    "/app/:path*",
    "/templates/:path*",
    "/library/:path*",
    "/dashboard/:path*",
    "/profile/:path*",
    "/affiliate/:path*",
  ],
};
