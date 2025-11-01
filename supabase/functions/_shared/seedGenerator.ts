/**
 * Seed generation utilities for deterministic carousel generation
 */

export function generateMasterSeed(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `${timestamp}${random}`;
}

export function deriveSeed(masterSeed: string, index: number): string {
  // Simple deterministic derivation: masterSeed + index * large prime
  const base = BigInt(masterSeed);
  const offset = BigInt(index) * 982451653n;
  const derived = base + offset;
  return derived.toString();
}
