import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  // Skip assets & public
  if (url.pathname.startsWith("/_next") || url.pathname.startsWith("/images")) {
    return NextResponse.next();
  }

  // Skip admin routes - they have their own protection via ProtectedRoute
  if (url.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Lis un flag d'env simple pour forcer OFF
  const ONBOARDING_ENABLED = process.env.NEXT_PUBLIC_ONBOARDING_ENABLED !== "off";

  // Si OFF → jamais de redirection onboarding
  if (!ONBOARDING_ENABLED) return NextResponse.next();

  // Exemple : si tu gardes le contrôle fin, vérifie un cookie/headers déjà mis par ton app
  const hasStudio = req.cookies.get("plan")?.value === "studio";
  const granted = req.cookies.get("granted_by_admin")?.value === "true";

  if ((url.pathname.startsWith("/dashboard") || url.pathname === "/") && !(hasStudio || granted)) {
    url.pathname = "/onboarding/activate";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
