export { CONTROL_CHARS_RE as CONTROL_CHARS_REGEX } from "@/lib/regex";

/**
 * Safely converts any value to a renderable string
 */
export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    console.warn('Attempting to render object as string:', value);
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Safely performs arithmetic and returns a number
 */
export function safeNumber(value: unknown, fallback: number = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
