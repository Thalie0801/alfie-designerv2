import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Exclut les assets Next et TOUT /api/health*
export const config = { matcher: ["/((?!_next|static|api/health*).*)"] };

export function middleware(req: NextRequest) {
  // Ne bloque rien pendant le debug
  const bypass = req.nextUrl.searchParams.get("bypass") === "1" || process.env.DISABLE_MW === "true";
  if (bypass) return NextResponse.next();
  return NextResponse.next();
}
