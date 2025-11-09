import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { JobStatus as JobStatusSchema } from "../../../src/types/api/generate";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabaseAdmin: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const IdSchema = z.object({ id: z.string().min(1) });

const STATUS_MAP: Record<string, "queued" | "running" | "done" | "error"> = {
  queued: "queued",
  running: "running",
  processing: "running",
  completed: "done",
  done: "done",
  failed: "error",
  error: "error",
};

function ensureSupabase(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured");
  }
  return supabaseAdmin;
}

function extractImageUrl(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === "string") return payload || null;
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
  return null;
}

function extractError(payload: unknown, fallback?: string | null): string | undefined {
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }
  if (!payload || typeof payload !== "object") return undefined;
  if ("error" in payload) {
    const value = (payload as Record<string, unknown>).error;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  if ("data" in payload) {
    return extractError((payload as Record<string, unknown>).data);
  }
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const idParam = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const parsed = IdSchema.safeParse({ id: idParam ?? "" });
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }

  try {
    const supabase = ensureSupabase();
    const { data, error } = await supabase
      .from("job_queue")
      .select("id, status, error, result")
      .eq("id", parsed.data.id)
      .single();

    if (error) {
      res.status(404).json({ error: "job_not_found" });
      return;
    }

    const status = STATUS_MAP[data.status] ?? "queued";
    const imageUrl = extractImageUrl(data.result ?? null) ?? undefined;
    const errorMessage = extractError(data.result ?? null, data.error ?? null);

    const body = JobStatusSchema.parse({
      status,
      imageUrl,
      error: errorMessage,
    });

    res.status(200).json(body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    res.status(500).json({ error: message });
  }
}
