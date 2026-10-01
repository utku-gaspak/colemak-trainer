export type Rng = () => number;

/** Small, fast, seedable PRNG (mulberry32) so generation is reproducible in tests. */
export function createRng(seed: number = Date.now()): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick from `items` with probability proportional to `weights`. */
export function weightedPick<T>(items: readonly T[], weights: readonly number[], rng: Rng): T | undefined {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
