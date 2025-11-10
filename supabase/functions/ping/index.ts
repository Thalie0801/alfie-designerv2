import { cors, fail, ok } from "../_shared/http.ts";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://lovable.dev",
  "https://*.lovable.app",
];

Deno.serve((req) => {
  const headers = cors(req.headers.get("origin"), ALLOWED_ORIGINS);

  if (req.method === "OPTIONS") {
    return ok({ preflight: true }, headers);
  }

  if (req.method !== "GET") {
    return fail(405, "Method not allowed", null, headers);
  }

  return ok(
    {
      message: "pong",
      timestamp: new Date().toISOString(),
    },
    headers,
  );
});
