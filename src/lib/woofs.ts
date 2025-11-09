export const WOOF_SECONDS = 12;

export function woofsForVideo(durationSec: number) {
  const d = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : WOOF_SECONDS;
  return Math.max(1, Math.ceil(d / WOOF_SECONDS));
}
