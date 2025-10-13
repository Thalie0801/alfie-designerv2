import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type RolePayload = {
  role?: "admin" | "client";
};

const ROLE_COOKIE = "appRole";
const ROLE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RolePayload;
    const role = body?.role === "admin" ? "admin" : "client";
    cookies().set(ROLE_COOKIE, role, { path: "/", maxAge: ROLE_MAX_AGE });
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    console.error("[api/role/set]", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
