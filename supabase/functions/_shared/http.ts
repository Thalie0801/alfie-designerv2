export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });

export function cors(origin: string | null, allowed: string[]) {
  const allowOrigin =
    origin && allowed.some((o) =>
      o.startsWith("https://*.") ? origin.endsWith(o.slice(10)) : origin === o
    )
      ? origin
      : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    Vary: "Origin",
  } as Record<string, string>;
}

export function ok(
  data: any,
  headers: Record<string, string> = {},
  status = 200,
) {
  return json({ ok: true, ...data }, { status, headers });
}
export function fail(
  status: number,
  message: string,
  details?: any,
  headers: Record<string, string> = {},
) {
  console.error("[edge] fail", { status, message, details });
  return json({ ok: false, status, message, details }, { status, headers });
}
