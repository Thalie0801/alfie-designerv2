import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type ThemePayload = {
  theme?: "light" | "dark";
};

const THEME_COOKIE = "theme";
const THEME_MAX_AGE = 60 * 60 * 24 * 180; // 180 jours

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ThemePayload;
    const theme = body?.theme === "dark" ? "dark" : "light";
    cookies().set(THEME_COOKIE, theme, { path: "/", maxAge: THEME_MAX_AGE });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/theme]", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
