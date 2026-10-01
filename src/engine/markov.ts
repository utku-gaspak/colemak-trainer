/**
 * Character-level Markov model with backoff.
 *
 * The model is trained once on the full English alphabet. At generation time
 * the caller restricts the output alphabet to the unlocked characters; the
 * sampler renormalises over what's left and backs off to shorter contexts
 * when a context has no allowed continuation. This yields pronounceable
 * nonsense from any subset of letters, from 8 keys up to the full layout.
 */
import { weightedPick, type Rng } from './rng';

export const START = '^';
export const END = '$';

export interface MarkovModel {
  order: number;
  /** tables[k] maps a context of length k to next-char counts. */
  tables: Map<string, Map<string, number>>[];
}

export function buildModel(words: readonly string[], order = 2): MarkovModel {
  const tables = Array.from({ length: order + 1 }, () => new Map<string, Map<string, number>>());
  for (const raw of words) {
    const w = raw.toLowerCase().replace(/[^a-zäöüß]/g, '');
    if (!w) continue;
    const padded = START.repeat(order) + w + END;
    for (let i = order; i < padded.length; i++) {
      const next = padded[i]!;
      for (let k = 0; k <= order; k++) {
        const ctx = padded.slice(i - k, i);
        let dist = tables[k]!.get(ctx);
        if (!dist) tables[k]!.set(ctx, (dist = new Map()));
        dist.set(next, (dist.get(next) ?? 0) + 1);
      }
    }
  }
  return { order, tables };
}

export interface SampleOptions {
  allowed: ReadonlySet<string>;
  canEnd: boolean;
  /** Multiplier applied to each candidate character's probability. */
  bias?: (ch: string) => number;
}

/**
 * Sample the next symbol (a character or END) given the padded history.
 * Returns undefined only if no context, down to the unigram, has an allowed
 * continuation.
 */
export function sampleNext(model: MarkovModel, history: string, opts: SampleOptions, rng: Rng): string | undefined {
  for (let k = model.order; k >= 0; k--) {
    const dist = model.tables[k]!.get(history.slice(history.length - k));
    if (!dist) continue;
    const items: string[] = [];
    const weights: number[] = [];
    for (const [ch, count] of dist) {
      if (ch === END ? !opts.canEnd : !opts.allowed.has(ch)) continue;
      items.push(ch);
      weights.push(count * (ch === END ? 1 : (opts.bias?.(ch) ?? 1)));
    }
    const pick = weightedPick(items, weights, rng);
    if (pick !== undefined) return pick;
  }
  return undefined;
}
