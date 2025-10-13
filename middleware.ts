import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AFFILIATE_COOKIE_NAME = "affiliateRef";
const AFFILIATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 jours

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const existingRole = req.cookies.get("appRole")?.value;
  const resolvedRole = existingRole === "admin" ? "admin" : "client";
  const bypassFlag = url.searchParams.get("bypass");
  const shouldBypass = bypassFlag === "1";
  const isAppRoute = url.pathname === "/app";
  const refCode = url.searchParams.get("ref")?.trim();

  let response: NextResponse;

  if (isAppRoute && resolvedRole !== "admin" && !shouldBypass) {
    const redirectUrl = new URL(req.url);
    redirectUrl.pathname = "/billing";
    redirectUrl.searchParams.delete("bypass");
    response = NextResponse.redirect(redirectUrl);
  } else {
    response = NextResponse.next();
  }

  if (!existingRole) {
    response.cookies.set("appRole", "client", {
      path: "/",
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
    });
  }

  if (refCode) {
    response.cookies.set(AFFILIATE_COOKIE_NAME, refCode, {
      path: "/",
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      maxAge: AFFILIATE_COOKIE_MAX_AGE,
    });
  }

  response.headers.set("Vary", "Cookie");
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}
