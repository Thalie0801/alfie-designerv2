/**
 * Regex to match control characters that should be removed from text
 * Built with RegExp constructor to avoid ESLint no-control-regex error
 */
export const CONTROL_CHARS_REGEX = /\p{Cc}|\u00A0|\uFEFF/gu;

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
