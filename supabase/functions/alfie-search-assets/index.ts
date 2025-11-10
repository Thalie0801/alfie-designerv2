import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../_shared/env.ts";

const RequestSchema = z.object({
  brandId: z.string().min(1),
  orderId: z.string().optional().nullable(),
});

type LibraryAsset = {
  id: string;
  order_id: string | null;
  kind: string;
  status: string;
  preview_url?: string | null;
  download_url?: string | null;
  url?: string | null;
  created_at: string;
  error_message?: string | null;
};

type JobRow = {
  id: string;
  status: string;
  type: string;
  order_id: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
  payload?: Record<string, unknown> | null;
};

type JobEventRow = {
  id: number;
  job_id: string;
  kind: string;
  message: string | null;
  created_at: string;
};

function mapAsset(row: LibraryAsset) {
  return {
    id: row.id,
    orderId: row.order_id,
    kind: row.kind,
    status: row.status,
    previewUrl: row.preview_url ?? row.url ?? null,
    downloadUrl: row.download_url ?? null,
    url: row.url ?? null,
    createdAt: row.created_at,
    errorMessage: row.error_message ?? null,
  };
}

function mapJob(row: JobRow, events: JobEventRow[]) {
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    orderId: row.order_id ?? "",
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    errorMessage: row.error_message ?? null,
    events: events
      .filter((event) => event.job_id === row.id)
      .map((event) => ({
        id: event.id,
        kind: event.kind,
        message: event.message,
        createdAt: event.created_at,
      })),
  };
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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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
    const { brandId, orderId } = RequestSchema.parse(rawBody);

    let scopedOrderIds: string[] = [];

    if (orderId) {
      const { data: orderCheck } = await userClient
        .from("orders")
        .select("id")
        .eq("id", orderId)
        .eq("brand_id", brandId)
        .maybeSingle();

      if (!orderCheck) {
        return new Response(JSON.stringify({ error: "order_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      scopedOrderIds = [orderId];
    } else {
      const { data: orderList } = await userClient
        .from("orders")
        .select("id")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(20);
      scopedOrderIds = (orderList ?? []).map((row) => row.id);
    }

    let assetQuery = userClient
      .from("library_assets")
      .select("id, order_id, kind, status, preview_url, download_url, url, created_at, error_message")
      .order("created_at", { ascending: false })
      .limit(40);

    if (scopedOrderIds.length > 0) {
      assetQuery = assetQuery.in("order_id", scopedOrderIds);
    } else {
      assetQuery = assetQuery.eq("brand_id", brandId);
    }

    const { data: assetsRaw, error: assetsError } = await assetQuery;
    if (assetsError) {
      console.error("[alfie-search-assets] assets query failed", assetsError);
      return new Response(JSON.stringify({ error: "assets_query_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jobQuery = userClient
      .from("job_queue")
      .select("id, status, type, order_id, created_at, started_at, finished_at, error_message, payload")
      .order("created_at", { ascending: false })
      .limit(25);

    if (scopedOrderIds.length > 0) {
      jobQuery = jobQuery.in("order_id", scopedOrderIds);
    } else {
      jobQuery = jobQuery.contains("payload", { brand_id: brandId });
    }

    const { data: jobsRaw, error: jobsError } = await jobQuery;
    if (jobsError) {
      console.error("[alfie-search-assets] jobs query failed", jobsError);
      return new Response(JSON.stringify({ error: "jobs_query_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobIds = (jobsRaw ?? []).map((job) => job.id);
    let events: JobEventRow[] = [];
    if (jobIds.length > 0) {
      const { data: eventsRaw, error: eventsError } = await userClient
        .from("job_events")
        .select("id, job_id, kind, message, created_at")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });
      if (eventsError) {
        console.error("[alfie-search-assets] events query failed", eventsError);
      } else {
        events = eventsRaw ?? [];
      }
    }

    const assets = (assetsRaw ?? []).map(mapAsset);
    const jobs = (jobsRaw ?? []).map((job) => mapJob(job, events));

    return new Response(JSON.stringify({ assets, jobs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[alfie-search-assets] unexpected error", err);
    const message = err instanceof z.ZodError ? err.issues.map((issue) => issue.message).join(" | ") : "unexpected_error";
    return new Response(JSON.stringify({ error: message }), {
      status: err instanceof z.ZodError ? 400 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
