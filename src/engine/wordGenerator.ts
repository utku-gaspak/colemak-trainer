/**
 * Lesson generation: pronounceable nonsense words from unlocked keys only,
 * with weak-key injection.
 *
 * Two levers, deliberately separate:
 *  - Focus key (newest unlock): biased at the *character* level inside the
 *    Markov sampler, plus a floor: whenever fewer than `focusShare` of the
 *    line's words so far contain it, the next word must. Without the floor,
 *    rare letters (j, z, q, ß) appear in ~1-5% of words and their level stalls.
 *  - Weak keys (measured, top 3): biased at the *word* level. Each slot draws a
 *    pool of candidates and picks one with weight 1 + weakBoost (default 0.3)
 *    if it contains a weak key, i.e. such words are ~30% more likely to be
 *    chosen than they would be naturally. Once a key's confidence recovers it
 *    drops out of the weak set and the boost stops.
 */
import { CORPUS, GERMAN_CORPUS } from './corpus';
import { buildModel, END, sampleNext, START, type MarkovModel } from './markov';
import type { WeakKey } from './keyStats';
import { createRng, weightedPick, type Rng } from './rng';

let englishModel: MarkovModel | undefined;
let germanModel: MarkovModel | undefined;
const GERMAN_CHARS = ['ä', 'ö', 'ü', 'ß'];

/** English-only until a German character is unlocked, then English + German. */
function defaultModel(allowed: ReadonlySet<string>): MarkovModel {
  if (GERMAN_CHARS.some((c) => allowed.has(c))) return (germanModel ??= buildModel([...CORPUS, ...GERMAN_CORPUS], 2));
  return (englishModel ??= buildModel(CORPUS, 2));
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'ä', 'ö', 'ü']);

/** Real words a phonotactic model can stumble into that don't belong in drills. */
const REJECT = new Set(['anal', 'anus', 'cock', 'crap', 'cum', 'cunt', 'dick', 'fag', 'fuck', 'homo', 'nazi', 'nigger', 'nigga', 'penis', 'piss', 'porn', 'rape', 'shit', 'slut', 'tits', 'twat', 'whore']);

export interface GeneratorOptions {
  allowed: readonly string[];
  focus?: readonly string[];
  weak?: readonly WeakKey[];
  wordCount: number;
  /** Word-level weight bonus for words containing weak keys. */
  weakBoost?: number;
  /** Character-level probability multiplier for focus keys. */
  focusBoost?: number;
  minLength?: number;
  maxLength?: number;
  /** Candidates drawn per word slot for weighted selection. */
  poolSize?: number;
  /** Minimum fraction of words containing a focus key (when focus isn't the whole alphabet). */
  focusShare?: number;
  rng?: Rng;
  model?: MarkovModel;
}

interface WordContext {
  model: MarkovModel;
  allowed: ReadonlySet<string>;
  bias: (ch: string) => number;
  minLength: number;
  maxLength: number;
  rng: Rng;
}

/** Fallback when the model is exhausted: alternate consonant/vowel. */
function fallbackChar(word: string, allowed: readonly string[], rng: Rng): string {
  const lastIsVowel = word.length > 0 && VOWELS.has(word[word.length - 1]!);
  const preferred = allowed.filter((c) => VOWELS.has(c) !== lastIsVowel);
  const pool = preferred.length > 0 ? preferred : allowed;
  return pool[Math.floor(rng() * pool.length)]!;
}

/**
 * One attempt: walk the chain until it emits END (a natural word ending).
 * Returns undefined if it ran into the length cap instead.
 */
function walk(ctx: WordContext, allowedList: readonly string[]): string | undefined {
  const { model, allowed, rng } = ctx;
  let word = '';
  let guard = 0;
  while (guard++ < 50) {
    if (word.length >= ctx.maxLength) return undefined;
    const history = START.repeat(model.order) + word;
    const next = sampleNext(model, history, { allowed, canEnd: word.length >= ctx.minLength, bias: ctx.bias }, rng);
    if (next === END) return word;
    const ch = next ?? fallbackChar(word, allowedList, rng);
    // No triples like "eee".
    if (word.length >= 2 && word[word.length - 1] === ch && word[word.length - 2] === ch) continue;
    word += ch;
  }
  return undefined;
}

export function generateWord(ctx: WordContext): string {
  const allowedList = [...ctx.allowed];
  const hasVowels = allowedList.some((c) => VOWELS.has(c));
  let last = allowedList[0] ?? '';
  // Rejection sampling: keep naturally-ended words that contain a vowel.
  for (let attempt = 0; attempt < 12; attempt++) {
    const w = walk(ctx, allowedList);
    if (w === undefined || REJECT.has(w)) continue;
    last = w;
    if (!hasVowels || [...w].some((c) => VOWELS.has(c))) return w;
  }
  while (last.length < ctx.minLength) last += fallbackChar(last, allowedList, ctx.rng);
  return last;
}

export function generateLesson(opts: GeneratorOptions): string[] {
  const rng = opts.rng ?? createRng();
  const allowed = new Set(opts.allowed);
  const focus = new Set(opts.focus ?? []);
  const weak = new Set((opts.weak ?? []).map((w) => w.char));
  const weakBoost = opts.weakBoost ?? 0.3;
  const focusBoost = opts.focusBoost ?? 3;
  // With very few keys, long words are just noise; scale length with alphabet.
  const maxLength = opts.maxLength ?? Math.min(8, 4 + Math.floor(allowed.size / 6));

  const ctx: WordContext = {
    model: opts.model ?? defaultModel(allowed),
    allowed,
    // Only boost focus chars if focus isn't the whole alphabet (level 1).
    bias: focus.size > 0 && focus.size < allowed.size ? (ch) => (focus.has(ch) ? focusBoost : 1) : () => 1,
    minLength: opts.minLength ?? 2,
    maxLength,
    rng,
  };

  const poolSize = opts.poolSize ?? 6;
  const focusShare = focus.size > 0 && focus.size < allowed.size ? (opts.focusShare ?? 0.3) : 0;
  const hasFocus = (w: string) => [...w].some((c) => focus.has(c));
  // When a focus word is required, push harder on the focus letter mid-word.
  const huntCtx: WordContext = { ...ctx, bias: (ch) => (focus.has(ch) ? focusBoost * 4 : 1) };
  const words: string[] = [];
  let focusWords = 0;
  for (let i = 0; i < opts.wordCount; i++) {
    if (focusWords < focusShare * (i + 1)) {
      const w = findFocusWord(huntCtx, hasFocus, words[words.length - 1]);
      if (w) {
        words.push(w);
        focusWords++;
        continue;
      }
    }
    const pool: string[] = [];
    const weights: number[] = [];
    for (let j = 0; j < poolSize; j++) {
      const w = generateWord(ctx);
      if (w === words[words.length - 1]) continue; // no back-to-back repeats
      pool.push(w);
      weights.push([...w].some((c) => weak.has(c)) ? 1 + weakBoost : 1);
    }
    const picked = weightedPick(pool, weights, rng) ?? generateWord(ctx);
    words.push(picked);
    if (hasFocus(picked)) focusWords++;
  }
  return words;
}

/** Draw until a word contains a focus key; undefined if the model can't produce one. */
function findFocusWord(ctx: WordContext, hasFocus: (w: string) => boolean, previous: string | undefined): string | undefined {
  for (let tries = 0; tries < 80; tries++) {
    const w = generateWord(ctx);
    if (hasFocus(w) && w !== previous) return w;
  }
  return undefined;
}
