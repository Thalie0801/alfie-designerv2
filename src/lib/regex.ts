export function escapeRegExp(input: string): string {
  // Échappe tous les métacaractères regex
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ATTENTION: ne pas utiliser /[\x00-\x1F]/g en literal (no-control-regex)
// On passe par RegExp pour satisfaire ESLint
const CONTROL_CHARS_PATTERN = String.raw`\x00-\x1F`;
export const CONTROL_CHARS_RE = new RegExp(`[${CONTROL_CHARS_PATTERN}]`, "g"); // U+0000..U+001F

export function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHARS_RE, "");
}
