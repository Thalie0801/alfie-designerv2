import { supabase } from "@/lib/supabaseClient";
import { getAuthHeader } from "@/lib/auth";

export type AspectRatio = "1:1" | "9:16" | "16:9";

interface BaseParams {
  prompt: string;
  brandId: string;
  aspectRatio: AspectRatio;
  inputMedia?: { type: "image" | "video"; url: string }[];
}

const IMAGE_SIZE_MAP = {
  "1:1": { width: 1024, height: 1024 },
  "9:16": { width: 1024, height: 1820 },
  "16:9": { width: 1820, height: 1024 },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type CreateMediaOrderInput = {
  kind: "image" | "video";
  prompt: string;
  brandId?: string | null;
  quantity?: number;
  aspectRatio?: keyof typeof IMAGE_SIZE_MAP;
  durationSec?: number;
  sourceUrl?: string | null;
  sourceType?: "image" | "video" | null;
};

export type CreateMediaOrderResult = {
  orderId: string | null;
  data: unknown;
};

export async function createMediaOrder(
  input: CreateMediaOrderInput,
): Promise<CreateMediaOrderResult> {
  if (input.kind === "image") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    const promptValue = input.prompt || "transform this";
    const targetFunction = input.sourceUrl
      ? "alfie-generate-ai-image"
      : "alfie-render-image";

    const payload: Record<string, unknown> = {
      prompt: promptValue,
      aspectRatio: input.aspectRatio,
      brand_id: input.brandId ?? null,
    };

    if (input.sourceUrl) {
      payload.sourceUrl = input.sourceUrl;
    } else if (input.aspectRatio) {
      const size = IMAGE_SIZE_MAP[input.aspectRatio];
      if (size) {
        payload.width = size.width;
        payload.height = size.height;
      }
    }

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body: payload,
      headers,
    });

    if (error) throw error;

    const responseRecord = isRecord(data) ? data : null;
    const isStructuredResponse =
      responseRecord && ("ok" in responseRecord || "data" in responseRecord);

    if (isStructuredResponse) {
      if ("ok" in responseRecord && responseRecord.ok === false) {
        const structuredError =
          typeof responseRecord.error === "string"
            ? responseRecord.error
            : isRecord(responseRecord.data) &&
                typeof responseRecord.data.error === "string"
              ? (responseRecord.data.error as string)
              : "Erreur de génération";
        throw new Error(structuredError);
      }

      const nestedData = isRecord(responseRecord.data)
        ? (responseRecord.data as Record<string, unknown>)
        : null;

      const responseOrderId =
        (typeof nestedData?.orderId === "string" && nestedData.orderId) ||
        (typeof responseRecord.orderId === "string"
          ? responseRecord.orderId
          : null);

      if (!responseOrderId) {
        throw new Error("no orderId in response");
      }

      return { data, orderId: responseOrderId };
    }

    return { data, orderId: null };
  }

  if (input.kind === "video") {
    const { data, error } = await supabase.functions.invoke("alfie-orchestrator", {
      body: {
        message: input.prompt,
        user_message: input.prompt,
        brandId: input.brandId,
        forceTool: "generate_video",
        aspectRatio: input.aspectRatio,
        durationSec: input.durationSec,
        uploadedSourceUrl: input.sourceUrl ?? null,
        uploadedSourceType: input.sourceType ?? null,
      },
    });

    if (error) throw error;
    if (isRecord(data) && typeof data.error === "string") {
      throw new Error(data.error);
    }

    const orderId =
      (isRecord(data) && typeof data.orderId === "string" && data.orderId) || null;

    if (!orderId) {
      throw new Error("L’orchestrateur n’a pas renvoyé d’orderId.");
    }

    return { data, orderId };
  }

  throw new Error(`Unsupported media kind: ${input.kind}`);
}

export async function generateImage(params: BaseParams): Promise<string> {
  return generateSingle({ ...params, type: "image" });
}

export async function generateCarousel(
  params: BaseParams & { slides: number },
): Promise<string> {
  return generateSingle({ ...params, type: "carousel", quantity: 1, slides: params.slides });
}

export async function generateVideo(
  params: BaseParams & { durationSeconds: number },
): Promise<string> {
  return generateSingle({ ...params, type: "video", duration: params.durationSeconds });
}

async function generateSingle(body: Record<string, any>): Promise<string> {
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch("/functions/v1/studio-generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.resourceId) {
      console.error("[studioApi] studio-generate error", {
        status: res.status,
        data,
      });
      const details =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.details === "string"
            ? data.details
            : `Erreur serveur (${res.status})`;
      throw new Error(details);
    }

    return data.resourceId as string;
  } catch (error) {
    console.error("[studioApi] studio-generate request failed", error);
    throw error instanceof Error
      ? error
      : new Error("Impossible de lancer la génération");
  }
}
