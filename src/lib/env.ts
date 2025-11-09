export const IS_BROWSER = typeof window !== "undefined";
export const HOST = IS_BROWSER ? window.location.host : "";
export const IS_LOVABLE_PREVIEW =
  IS_BROWSER && (HOST.endsWith(".lovable.app") || HOST === "lovable.dev");

export const EDGE_BASE = import.meta.env.VITE_EDGE_BASE_URL || ""; // ex: https://<ref>.functions.supabase.co
export const CAN_USE_PROXY = !!EDGE_BASE && !IS_LOVABLE_PREVIEW;
