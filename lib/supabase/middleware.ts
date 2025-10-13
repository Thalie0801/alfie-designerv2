import type { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const AUTH_COOKIE_SUFFIX = "-auth-token";

type MiddlewareClientResult = {
  client: SupabaseClient;
  accessToken: string | null;
};

function resolveProjectRef(url: string | undefined) {
  if (!url) return null;
  const match = /https?:\/\/([a-z0-9-]+)\.supabase\.co/i.exec(url);
  return match?.[1] ?? null;
}

function extractAccessToken(rawValue: string | undefined) {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    return (
      parsed?.access_token ??
      parsed?.currentSession?.access_token ??
      parsed?.currentSession?.accessToken ??
      null
    );
  } catch (error) {
    console.error("[supabase/middleware] unable to parse cookie", error);
    return null;
  }
}

export function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse
): MiddlewareClientResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase credentials missing");
  }

  const projectRef = resolveProjectRef(url);
  const cookieName = projectRef ? `sb-${projectRef}${AUTH_COOKIE_SUFFIX}` : null;
  const cookieValue = cookieName ? request.cookies.get(cookieName)?.value : undefined;
  const accessToken = extractAccessToken(cookieValue);

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });

  return { client, accessToken };
}
