import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.224.0/hash/mod.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } from "../_shared/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RequestSchema = z.object({
  folder: z.string().min(1),
  publicId: z.string().min(1),
  tags: z.array(z.string()).default([]),
  context: z.record(z.string(), z.string()).default({}),
});

function buildSignatureParams(input: z.infer<typeof RequestSchema>) {
  const timestamp = Math.floor(Date.now() / 1000);
  const contextString = Object.entries(input.context)
    .filter(([_, value]) => value && value.trim().length > 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("|");

  const params: Record<string, string> = {
    folder: input.folder,
    public_id: input.publicId,
    timestamp: String(timestamp),
  };

  if (input.tags.length > 0) {
    params.tags = input.tags.join(",");
  }

  if (contextString) {
    params.context = contextString;
  }

  return { params, timestamp };
}

function signParams(params: Record<string, string>, secret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const hash = createHash("sha1");
  hash.update(`${toSign}${secret}`);
  return hash.toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || !CLOUDINARY_CLOUD_NAME) {
    return new Response(JSON.stringify({ error: "missing_configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json();
    const payload = RequestSchema.parse(rawBody);

    const { params, timestamp } = buildSignatureParams(payload);
    const signature = signParams(params, CLOUDINARY_API_SECRET);

    return new Response(
      JSON.stringify({
        signature,
        timestamp,
        apiKey: CLOUDINARY_API_KEY,
        cloudName: CLOUDINARY_CLOUD_NAME,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[alfie-sign-upload] unexpected error", err);
    const message = err instanceof z.ZodError ? err.issues.map((issue) => issue.message).join(" | ") : "unexpected_error";
    return new Response(JSON.stringify({ error: message }), {
      status: err instanceof z.ZodError ? 400 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
