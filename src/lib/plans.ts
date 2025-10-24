export type Plan = 'starter' | 'pro' | 'studio';

export const ALL_PLANS: Plan[] = ['starter', 'pro', 'studio'];

export function isValidPlan(p: string): p is Plan {
  return (ALL_PLANS as string[]).includes(p);
}
