// Logger pour les générations (conformité RGPD - logs sobres)
import { supabase } from "@/lib/supabase";
import { truncatePromptForLog } from "@/config/systemConfig";

export type EngineType = "nano" | "sora" | "veo3";
export type GenType = "image" | "video";
export type GenStatus = "success" | "failed";

export interface GenerationLogData {
  brandId: string | null;
  userId: string;
  type: GenType;
  engine?: EngineType;
  prompt: string;
  woofsCost?: number;
  status: GenStatus;
  durationSeconds?: number;
  errorCode?: string;
  metadata?: Record<string, any>;
}

/* ------------------------------ RGPD utils ------------------------------ */

const REDACTED = "[[redacted]]";
const MAX_PROMPT_CHARS = 300; // garde fou si truncatePromptForLog change
const MAX_METADATA_KEYS = 40;
const MAX_METADATA_DEPTH = 3;
const MAX_METADATA_JSON_BYTES = 8_000; // ~8KB

// Masque emails, téléphones FR/intl simples, urls http(s), tokens hex
const PII_PATTERNS: RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?\d[\s.-]?){7,}\d\b/g, // heuristique tél
  /\bhttps?:\/\/[^\s)>'"]+/gi,
  /\b[A-F0-9]{32,}\b/gi, // tokens/ids hex longs
];

function redactPII(input: string): string {
  let out = input;
  for (const re of PII_PATTERNS) out = out.replace(re, REDACTED);
  return out;
}

// Sécurité supplémentaire autour de truncatePromptForLog
function safePromptSummary(prompt: string): string {
  try {
    const truncated = truncatePromptForLog?.(prompt) ?? prompt.slice(0, MAX_PROMPT_CHARS);
    return redactPII(truncated).slice(0, MAX_PROMPT_CHARS);
  } catch {
    return redactPII(prompt).slice(0, MAX_PROMPT_CHARS);
  }
}

// Coupe profondeur/clé/poids JSON + redact PII sur strings
function sanitizeMetadata(meta?: Record<string, any>): Record<string, any> {
  if (!meta || typeof meta !== "object") return {};
  const limited: Record<string, any> = {};
  const keys = Object.keys(meta).slice(0, MAX_METADATA_KEYS);

  const walk = (val: any, depth: number): any => {
    if (depth >= MAX_METADATA_DEPTH) return "[…]";
    if (val == null) return val;
    if (typeof val === "string") return redactPII(val).slice(0, 500);
    if (typeof val === "number" || typeof val === "boolean") return val;
    if (Array.isArray(val)) return val.slice(0, 20).map((v) => walk(v, depth + 1));
    if (typeof val === "object") {
      const o: Record<string, any> = {};
      for (const k of Object.keys(val).slice(0, 20)) {
        o[k] = walk(val[k], depth + 1);
      }
      return o;
    }
    return String(val).slice(0, 200);
  };

  for (const k of keys) {
    if (k.toLowerCase().includes("prompt")) continue; // ne jamais refléter le prompt brut
    limited[k] = walk(meta[k], 0);
  }

  // garde-fou sur le poids JSON
  let json = "";
  try {
    json = JSON.stringify(limited);
  } catch {
    return {};
  }
  if (json.length > MAX_METADATA_JSON_BYTES) {
    // on tente une réduction simple en ne gardant que les premières clés
    const slim: Record<string, any> = {};
    for (const k of Object.keys(limited)) {
      slim[k] = limited[k];
      if (JSON.stringify(slim).length > MAX_METADATA_JSON_BYTES) {
        delete slim[k];
        break;
      }
    }
    return slim;
  }
  return limited;
}

/* ------------------------------- Public API ------------------------------ */

/**
 * Log une génération dans la table generation_logs
 * Respecte la conformité RGPD avec prompts tronqués + PII masquée
 */
export async function logGeneration(data: GenerationLogData): Promise<void> {
  try {
    const payload = {
      brand_id: data.brandId,
      user_id: data.userId,
      type: data.type,
      engine: data.engine ?? null,
      prompt_summary: safePromptSummary(data.prompt),
      woofs_cost: Number.isFinite(data.woofsCost) ? data.woofsCost : 0,
      status: data.status,
      duration_seconds: data.durationSeconds ?? null,
      error_code: data.errorCode ?? null,
      metadata: sanitizeMetadata(data.metadata),
    };

    const { error } = await supabase.from("generation_logs").insert(payload);
    if (error) console.error("[LOGGER] Error logging generation:", error);
  } catch (err) {
    console.error("[LOGGER] Exception logging generation:", err);
  }
}

/**
 * Récupère les logs de génération d'un utilisateur
 */
export async function getUserGenerationLogs(userId: string, limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("generation_logs")
      .select(
        "id, created_at, type, engine, status, duration_seconds, woofs_cost, prompt_summary, error_code, brand_id, metadata",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("[LOGGER] Error fetching user logs:", err);
    return [];
  }
}

/**
 * Récupère les logs d'une marque
 */
export async function getBrandGenerationLogs(brandId: string, limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("generation_logs")
      .select(
        "id, created_at, type, engine, status, duration_seconds, woofs_cost, prompt_summary, error_code, user_id, metadata",
      )
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("[LOGGER] Error fetching brand logs:", err);
    return [];
  }
}

/**
 * Délimite le mois courant en ISO (UTC) : [firstDay, firstDayNextMonth[
 */
function getCurrentMonthBounds(): { fromISO: string; toISO: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

/**
 * Statistiques basiques pour analytics V2.1 (mois courant)
 */
export async function getBrandAnalytics(brandId: string): Promise<{
  totalGenerations: number;
  totalImages: number;
  totalVideos: number;
  soraCount: number;
  veo3Count: number;
  avgDurationSeconds: number;
  successRate: number;
}> {
  try {
    const { fromISO, toISO } = getCurrentMonthBounds();

    const { data, error } = await supabase
      .from("generation_logs")
      .select("type,engine,duration_seconds,status")
      .eq("brand_id", brandId)
      .gte("created_at", fromISO)
      .lt("created_at", toISO);

    if (error) throw error;

    type Row = {
      type?: GenType | null;
      engine?: EngineType | null;
      duration_seconds?: number | null;
      status?: GenStatus | null;
    };

    const logs: Row[] = (data ?? []) as Row[];
    const totalGenerations = logs.length;

    let totalImages = 0;
    let totalVideos = 0;
    let soraCount = 0;
    let veo3Count = 0;
    let durationSum = 0;
    let successCount = 0;

    for (const l of logs) {
      if (l.type === "image") totalImages++;
      else if (l.type === "video") totalVideos++;

      if (l.engine === "sora") soraCount++;
      else if (l.engine === "veo3") veo3Count++;

      if (typeof l.duration_seconds === "number") durationSum += l.duration_seconds;
      if (l.status === "success") successCount++;
    }

    const avgDurationSeconds = totalGenerations ? Math.round(durationSum / totalGenerations) : 0;
    const successRate = totalGenerations ? Math.round((successCount / totalGenerations) * 100) : 0;

    return {
      totalGenerations,
      totalImages,
      totalVideos,
      soraCount,
      veo3Count,
      avgDurationSeconds,
      successRate,
    };
  } catch (err) {
    console.error("[ANALYTICS] Error calculating brand analytics:", err);
    return {
      totalGenerations: 0,
      totalImages: 0,
      totalVideos: 0,
      soraCount: 0,
      veo3Count: 0,
      avgDurationSeconds: 0,
      successRate: 0,
    };
  }
}

/* -------------------------- Helper de chronométrage -------------------------- */
/**
 * Enveloppe une génération, mesure la durée et log automatiquement.
 *
 * @example
 * await withGenerationTiming(
 *   { brandId, userId, type: 'video', engine: 'sora', prompt },
 *   async () => {
 *     // ... ta génération ici ...
 *     return { woofsCost: 3 }; // facultatif
 *   }
 * );
 */
export async function withGenerationTiming<T>(
  base: Omit<GenerationLogData, "status" | "durationSeconds" | "woofsCost"> & { woofsCost?: number },
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now?.() ?? Date.now();
  try {
    const result = await fn();
    const end = performance.now?.() ?? Date.now();
    await logGeneration({
      ...base,
      status: "success",
      durationSeconds: Math.round((end - start) / 1000),
      woofsCost: base.woofsCost,
      prompt: base.prompt, // sera tronqué/redacté
    });
    return result;
  } catch (e: any) {
    const end = performance.now?.() ?? Date.now();
    await logGeneration({
      ...base,
      status: "failed",
      durationSeconds: Math.round((end - start) / 1000),
      woofsCost: base.woofsCost ?? 0,
      errorCode: e?.code || e?.name || "GEN_UNKNOWN",
      prompt: base.prompt,
      metadata: { message: String(e?.message ?? e) },
    });
    throw e;
  }
}
