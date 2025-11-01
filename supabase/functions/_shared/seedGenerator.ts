/**
 * Seed generation utilities for deterministic carousel generation
 */

export function generateMasterSeed(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `${timestamp}${random}`;
}

function toBigIntSeed(seed: string): bigint {
  try {
    // Fast path for numeric strings
    return BigInt(seed);
  } catch {
    // Try to interpret as hex (e.g., UUID without dashes)
    const hex = seed.replace(/[^a-fA-F0-9]/g, '');
    if (hex.length >= 8) {
      try {
        return BigInt('0x' + hex.slice(0, 16)); // use first 64 bits
      } catch { /* fallthrough */ }
    }
    // Fallback: simple rolling hash to 63-bit positive bigint
    let h = 0n;
    const MOD = (1n << 63n) - 1n;
    for (let i = 0; i < seed.length; i++) {
      h = (h * 131n + BigInt(seed.charCodeAt(i))) & MOD;
    }
    return h === 0n ? 1n : h; // avoid zero
  }
}

export function deriveSeed(masterSeed: string, index: number): string {
  const base = toBigIntSeed(masterSeed);
  const offset = BigInt(index) * 982451653n; // large prime multiplier
  const derived = base + offset;
  return derived.toString();
}
