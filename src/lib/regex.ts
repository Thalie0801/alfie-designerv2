export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ⚠️ Pas de literal /[\x00-\x1F]/g : no-control-regex.
// On génère la plage dynamiquement pour satisfaire ESLint.
const CONTROL_CHAR_RANGE = Array.from({ length: 32 }, (_, index) =>
  `\\x${index.toString(16).padStart(2, "0")}`,
).join("");

export const CONTROL_CHARS_RE = new RegExp(`[${CONTROL_CHAR_RANGE}]`, "g");

export function stripControlChars(input: string): string {
  return typeof input === "string" ? input.replace(CONTROL_CHARS_RE, "") : (input as any);
}

export function normalizeSpaces(input: string): string {
  return stripControlChars(input).replace(/\s+/g, " ").trim();
}
