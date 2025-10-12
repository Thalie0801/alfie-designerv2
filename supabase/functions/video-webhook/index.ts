import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
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

const extractUrlFromValue = (value: JsonValue): string | null => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("http")) {
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as PayloadRecord;
    const id = typeof payload.id === "string" ? payload.id : undefined;

    if (!id) {
      return jsonResponse(JSON.stringify({ error: "missing id" }), 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const admin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: record, error: selectError } = await admin
      .from("media_generations")
      .select("id, metadata, output_url")
      .or(`job_id.eq.${id},metadata->>predictionId.eq.${id}`)
      .maybeSingle();

    if (selectError) {
      console.error("video-webhook select error", selectError);
      return jsonResponse(JSON.stringify({ error: "select failed" }), 500);
    }

    if (!record) {
      console.warn("video-webhook: no media_generation found for", id);
      return jsonResponse("\"ok\"");
    }

    const existingMetadata = (record.metadata as Record<string, unknown> | null) ?? {};
    const normalizedStatus = normalizeStatus(payload);
    const outputUrl = extractOutputUrl(payload);

    const metadata: Record<string, unknown> = {
      ...existingMetadata,
      lastWebhookAt: new Date().toISOString(),
      lastWebhookStatus: payload.status ?? payload.state ?? normalizedStatus,
      webhookPayload: payload
    };

    if (payload.error) {
      metadata.error = payload.error;
    }

    const update: Record<string, unknown> = {
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
      metadata
    };

    if (outputUrl) {
      update.output_url = outputUrl;
    }

    const { error: updateError } = await admin
      .from("media_generations")
      .update(update)
      .eq("id", record.id);

    if (updateError) {
      console.error("video-webhook update error", updateError);
      return jsonResponse(JSON.stringify({ error: "update failed" }), 500);
    }

    return jsonResponse("\"ok\"");
  } catch (error) {
    console.error("video-webhook error", error);
    const message = error instanceof Error ? error.message : "webhook error";
    return jsonResponse(JSON.stringify({ error: message }), 500);
  }
});
