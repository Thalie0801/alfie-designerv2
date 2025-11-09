import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { z } from "zod";

import {
  GenerateResponseAsync,
  GenerateResponseSync,
} from "../../src/types/api/generate";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const INTERNAL_FN_SECRET = process.env.INTERNAL_FN_SECRET ?? "";
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY ?? "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

const supabaseAdmin: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
}

const GenerateRequestSchema = z
  .object({
    mode: z.enum(["sync", "async"]).optional(),
    async: z.boolean().optional(),
    provider: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    userId: z.string().min(1),
    brandId: z.string().optional(),
    jobSetId: z.string().optional(),
    orderId: z.string().optional(),
    orderItemId: z.string().optional(),
    requestId: z.string().optional(),
    brandKit: z.record(z.unknown()).optional(),
    payload: z.record(z.unknown()).optional(),
    options: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    meta: z.unknown().optional(),
    upload: z
      .object({
        folder: z.string().optional(),
        tags: z.array(z.string()).optional(),
        context: z.record(z.string()).optional(),
      })
      .optional(),
    imageUrl: z.string().url().optional(),
    resolution: z.string().optional(),
    backgroundOnly: z.boolean().optional(),
    templateImageUrl: z.string().url().optional(),
    uploadedSourceUrl: z.string().url().optional(),
    overlayText: z.string().optional(),
    negativePrompt: z.string().optional(),
    slideIndex: z.number().int().optional(),
    totalSlides: z.number().int().optional(),
    carouselId: z.string().optional(),
    seed: z.string().optional(),
  })
  .passthrough();

type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

type CloudinaryUploadOptions = {
  brandId?: string | null;
  jobSetId?: string | null;
  requestedFolder?: string | null;
  tags?: string[];
  context?: Record<string, string>;
};

function ensureSupabase(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured");
  }
  return supabaseAdmin;
}

function ensureCloudinaryEnv() {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary environment not configured");
  }
}

function ensureInternalSecret() {
  if (!INTERNAL_FN_SECRET) {
    throw new Error("INTERNAL_FN_SECRET is not configured");
  }
}

function extractImageUrl(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    return payload || null;
  }
  if (typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.imageUrl,
    record.image_url,
    record.url,
    record.secureUrl,
    record.secure_url,
    record.outputUrl,
    record.output_url,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) {
      return candidate;
    }
  }
  if ("data" in record) {
    return extractImageUrl(record.data as unknown);
  }
  if (Array.isArray(record.output) && record.output.length > 0) {
    const first = record.output[0];
    if (typeof first === "string") return first;
    return extractImageUrl(first);
  }
  return null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  if ("error" in payload) {
    const value = (payload as Record<string, unknown>).error;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  if ("data" in payload) {
    return extractErrorMessage((payload as Record<string, unknown>).data);
  }
  return null;
}

function buildFolder(opts: CloudinaryUploadOptions): string {
  if (opts.requestedFolder && opts.requestedFolder.trim()) {
    return opts.requestedFolder.trim();
  }
  const segments = ["alfie"];
  if (opts.brandId) segments.push(String(opts.brandId));
  if (opts.jobSetId) segments.push(String(opts.jobSetId));
  return segments.join("/");
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return filtered.length ? filtered : undefined;
}

function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  const out: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (typeof raw === "string" && raw.trim().length > 0) {
      out[key] = raw;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

async function uploadToCloudinary(url: string, opts: CloudinaryUploadOptions): Promise<UploadApiResponse> {
  ensureCloudinaryEnv();
  const folder = buildFolder(opts);
  return cloudinary.uploader.upload(url, {
    folder,
    tags: opts.tags,
    context: opts.context,
    resource_type: "image",
  });
}

async function invokeImageProvider(input: GenerateRequest) {
  ensureInternalSecret();
  const supabase = ensureSupabase();
  const { data, error } = await supabase.functions.invoke("alfie-generate-ai-image", {
    body: {
      prompt: input.prompt,
      brandId: input.brandId,
      brandKit: input.brandKit,
      userId: input.userId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      requestId: input.requestId,
      backgroundOnly: input.backgroundOnly,
      templateImageUrl: input.templateImageUrl,
      uploadedSourceUrl: input.uploadedSourceUrl,
      resolution: input.resolution,
      overlayText: input.overlayText,
      negativePrompt: input.negativePrompt,
      slideIndex: input.slideIndex,
      totalSlides: input.totalSlides,
      carouselId: input.carouselId,
      seed: input.seed,
    },
    headers: {
      "X-Internal-Secret": INTERNAL_FN_SECRET,
    },
  });
  if (error) {
    throw new Error(error.message ?? "Image provider call failed");
  }
  return data;
}

async function handleSync(res: NextApiResponse, input: GenerateRequest) {
  if (!input.prompt && !input.payload?.prompt) {
    res.status(400).json({ error: "prompt_required" });
    return;
  }

  try {
    const providerResult = await invokeImageProvider(input);
    const providerError = extractErrorMessage(providerResult);
    if (providerError) {
      res.status(500).json({ error: providerError });
      return;
    }

    const rawImageUrl = extractImageUrl(providerResult);
    if (!rawImageUrl) {
      res.status(500).json({ error: "provider_missing_image_url" });
      return;
    }

    const uploadOptions: CloudinaryUploadOptions = {
      brandId: input.brandId ?? null,
      jobSetId: input.jobSetId ?? null,
      requestedFolder: input.upload?.folder ?? null,
      tags: normalizeStringArray(input.upload?.tags),
      context: normalizeStringRecord(input.upload?.context),
    };

    const upload = await uploadToCloudinary(rawImageUrl, uploadOptions);
    const responseBody = GenerateResponseSync.parse({
      imageUrl: upload.secure_url,
      assetId: typeof (providerResult as Record<string, unknown> | null)?.assetId === "string"
        ? (providerResult as Record<string, unknown>).assetId
        : undefined,
      meta: (providerResult as Record<string, unknown> | null)?.meta ?? undefined,
    });

    res.status(200).json(responseBody);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    res.status(500).json({ error: message });
  }
}

async function handleAsync(res: NextApiResponse, input: GenerateRequest) {
  try {
    const supabase = ensureSupabase();
    const payload = {
      provider: input.provider ?? "alfie-generate-ai-image",
      prompt: input.prompt ?? null,
      brandId: input.brandId ?? null,
      jobSetId: input.jobSetId ?? null,
      userId: input.userId,
      orderId: input.orderId ?? null,
      orderItemId: input.orderItemId ?? null,
      requestId: input.requestId ?? null,
      brandKit: input.brandKit ?? null,
      metadata: input.metadata ?? input.meta ?? null,
      options: input.options ?? null,
      upload: input.upload ?? null,
      resolution: input.resolution ?? null,
      backgroundOnly: input.backgroundOnly ?? null,
      templateImageUrl: input.templateImageUrl ?? null,
      uploadedSourceUrl: input.uploadedSourceUrl ?? null,
      overlayText: input.overlayText ?? null,
      negativePrompt: input.negativePrompt ?? null,
      slideIndex: input.slideIndex ?? null,
      totalSlides: input.totalSlides ?? null,
      carouselId: input.carouselId ?? null,
      seed: input.seed ?? null,
    };

    const { data, error } = await supabase
      .from("job_queue")
      .insert({
        user_id: input.userId,
        type: "api_generate_image",
        status: "queued",
        payload,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "job_insert_failed");
    }

    const responseBody = GenerateResponseAsync.parse({ jobId: data.id });
    res.status(202).json(responseBody);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    res.status(500).json({ error: message });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  let json: unknown;

  try {
    json = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    res.status(400).json({ error: "invalid_json" });
    return;
  }

  const parsed = GenerateRequestSchema.safeParse(json);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
    return;
  }

  const input = parsed.data;
  const wantsAsync = input.mode === "async" || input.async === true;

  if (wantsAsync) {
    await handleAsync(res, input);
  } else {
    await handleSync(res, input);
  }
}
