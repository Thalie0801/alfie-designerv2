import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-stripe-signature"
};

type JsonValue = Record<string, unknown> | string | null | undefined;

type PayloadRecord = Record<string, unknown> & {
  id?: string;
  status?: string;
  state?: string;
  output?: JsonValue;
  error?: unknown;
};

const jsonResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const normalizeStatus = (payload: PayloadRecord): "processing" | "completed" | "failed" => {
  const candidates: Array<string | undefined> = [
    typeof payload.status === "string" ? payload.status : undefined,
    typeof payload.state === "string" ? payload.state : undefined,
    typeof (payload.data as Record<string, unknown> | undefined)?.status === "string"
      ? (payload.data as Record<string, unknown>).status as string
      : undefined,
    typeof (payload.data as Record<string, unknown> | undefined)?.state === "string"
      ? (payload.data as Record<string, unknown>).state as string
      : undefined
  ];

  const value = candidates.find((item) => item && item.trim().length > 0)?.toLowerCase();
  if (!value) return "processing";

  if (["succeeded", "success", "completed", "ready", "finished"].includes(value)) {
    return "completed";
  }
  if (["failed", "fail", "error", "cancelled", "canceled"].includes(value)) {
    return "failed";
  }

  return "processing";
};

const isLikelyJson = (value: string) => {
  const trimmed = value.trim();
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
};

// ✅ SECURITY: Whitelist allowed domains to prevent malicious URL injection
const ALLOWED_DOMAINS = [
  'replicate.delivery',
  'pbxt.replicate.delivery',
  'kie-api-cdn.com',
  'cdn.kie.ai'
];

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(domain => parsed.hostname.endsWith(domain));
  } catch {
    return false;
  }
};

const extractUrlFromValue = (value: JsonValue): string | null => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("http")) {
      // ✅ Validate URL against whitelist
      if (!isValidUrl(trimmed)) {
        console.warn(`⚠️ Rejected non-whitelisted URL: ${trimmed}`);
        return null;
      }
      return trimmed;
    }
    if (isLikelyJson(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractUrlFromValue(parsed as JsonValue);
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractUrlFromValue(item as JsonValue);
      if (extracted) return extracted;
    }
    return null;
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const preferredKeys = [
      "video",
      "video_url",
      "url",
      "mp4",
      "src",
      "href"
    ];

    for (const key of preferredKeys) {
      const candidate = objectValue[key];
      const extracted = extractUrlFromValue(candidate as JsonValue);
      if (extracted) {
        return extracted;
      }
    }

    if (Object.prototype.hasOwnProperty.call(objectValue, "resultUrls")) {
      const extracted = extractUrlFromValue(objectValue.resultUrls as JsonValue);
      if (extracted) return extracted;
    }

    if (Object.prototype.hasOwnProperty.call(objectValue, "data")) {
      const extracted = extractUrlFromValue(objectValue.data as JsonValue);
      if (extracted) return extracted;
    }
  }

  return null;
};

const extractOutputUrl = (payload: PayloadRecord): string | null => {
  const directKeys: Array<keyof PayloadRecord> = ["output"];

  for (const key of directKeys) {
    const extracted = extractUrlFromValue(payload[key] as JsonValue);
    if (extracted) return extracted;
  }

  const nestedSources: JsonValue[] = [
    (payload.urls as JsonValue) ?? null,
    (payload.video as JsonValue) ?? null,
    (payload.result as JsonValue) ?? null,
    (payload.result_url as JsonValue) ?? null,
    (payload.resultUrls as JsonValue) ?? null
  ];

  for (const source of nestedSources) {
    const extracted = extractUrlFromValue(source);
    if (extracted) return extracted;
  }

  const data = payload.data as Record<string, unknown> | undefined;
  if (data) {
    const candidates: JsonValue[] = [
      data.output as JsonValue,
      data.result as JsonValue,
      data.resultUrls as JsonValue,
      data.video as JsonValue,
      data.video_url as JsonValue
    ];

    if (typeof data.resultJson === "string") {
      candidates.push(data.resultJson as string);
    }

    for (const candidate of candidates) {
      const extracted = extractUrlFromValue(candidate);
      if (extracted) return extracted;
    }
  }

  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSignature = req.headers.get('x-stripe-signature');
    if (!stripeSignature) {
      throw new Error('Missing Stripe signature');
    }

    // TODO: Implémenter la vérification de la signature Stripe
    // const valid = await verifyStripeWebhook(req.body, stripeSignature);
    // if (!valid) {
    //   throw new Error('Invalid Stripe signature');
    // }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();

    // TODO: Traiter le webhook validé

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[video-webhook] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
