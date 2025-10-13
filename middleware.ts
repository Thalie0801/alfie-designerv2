import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get("appRole")) {
    res.cookies.set("appRole", "client", { path: "/", sameSite: "lax" });
  }
  res.headers.set("Vary", "Cookie");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
