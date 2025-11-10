export const FLAGS = {
  DESIGN_API: import.meta.env.VITE_FLAG_DESIGN_API === '1',
  CAROUSEL: import.meta.env.VITE_FLAG_CAROUSEL === '1',
  VIDEO: import.meta.env.VITE_FLAG_VIDEO === '1',
} as const;

export type FeatureFlagName = keyof typeof FLAGS;

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return Boolean(FLAGS[name]);
}
