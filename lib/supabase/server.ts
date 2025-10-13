import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseServerClient = SupabaseClient;

type ServerClientResult = {
  client: SupabaseServerClient;
  accessToken: string | null;
};

const AUTH_COOKIE_SUFFIX = "-auth-token";

function resolveProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const match = /https?:\/\/([a-z0-9-]+)\.supabase\.co/i.exec(url);
    return match?.[1] ?? null;
  } catch (error) {
    console.error("[supabase/server] unable to resolve project ref", error);
    return null;
  }
}

function extractAccessToken(rawCookie: string | undefined): string | null {
  if (!rawCookie) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawCookie);
    const token =
      parsed?.access_token ??
      parsed?.currentSession?.access_token ??
      parsed?.currentSession?.accessToken ??
      null;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch (error) {
    console.error("[supabase/server] unable to parse auth cookie", error);
    return null;
  }
}

export function createServerClient(): ServerClientResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase credentials are missing. Check your environment variables.");
  }

  const cookieStore = cookies();
  const projectRef = resolveProjectRef(url);
  const cookieName = projectRef ? `sb-${projectRef}${AUTH_COOKIE_SUFFIX}` : undefined;
  const cookieValue = cookieName ? cookieStore.get(cookieName)?.value : undefined;
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
