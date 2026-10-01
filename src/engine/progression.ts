/**
 * Level promotion.
 *
 * Keybr stalls because it waits until *every* unlocked key reaches the target
 * speed, so one stubborn key freezes the whole run. Here promotion is gated
 * only by:
 *   1. overall accuracy over a rolling window of words since the last unlock,
 *   2. rhythm stability over that window (1 - coefficient of variation of WPM),
 *   3. the focus key(s) having enough clean reps to be considered learned.
 * Weak old keys never block promotion; they are re-injected by the word
 * generator instead. If the user plateaus anyway, thresholds relax gradually.
 */
import { MIN_SAMPLES, type KeyStatsMap } from './keyStats';
import { mean, stdDev } from './metrics';

export interface WordResult {
  word: string;
  /** Target characters including the trailing space, if any. */
  chars: number;
  errors: number;
  durationMs: number;
  wpm: number;
  at: number;
}

export interface PromotionConfig {
  windowWords: number;
  minAccuracy: number;
  minStability: number;
  /** Clean reps each focus key needs (per key) before promotion. */
  minFocusReps: number;
  minFocusAccuracy: number;
  /** After this many words at a level, start relaxing thresholds. */
  stallAfterWords: number;
  /** Relax one step per this many further words. */
  relaxEveryWords: number;
  accuracyFloor: number;
  stabilityFloor: number;
}

export const DEFAULT_PROMOTION: PromotionConfig = {
  windowWords: 20,
  minAccuracy: 0.95,
  minStability: 0.7,
  minFocusReps: 12,
  minFocusAccuracy: 0.9,
  stallAfterWords: 150,
  relaxEveryWords: 50,
  accuracyFloor: 0.9,
  stabilityFloor: 0.5,
};

export interface PromotionCheck {
  id: 'window' | 'accuracy' | 'stability' | 'focus';
  label: string;
  value: number;
  target: number;
  pass: boolean;
}

export interface PromotionStatus {
  ready: boolean;
  /** 0..1, the least-satisfied check (for a progress meter). */
  progress: number;
  relaxSteps: number;
  checks: PromotionCheck[];
}

export function windowStability(words: readonly WordResult[]): number {
  const speeds = words.map((w) => w.wpm).filter((v) => v > 0);
  const m = mean(speeds);
  if (speeds.length < 2 || m === 0) return 0;
  return Math.max(0, Math.min(1, 1 - stdDev(speeds) / m));
}

export function windowAccuracy(words: readonly WordResult[]): number {
  let chars = 0;
  let errors = 0;
  for (const w of words) {
    chars += w.chars;
    errors += w.errors;
  }
  return chars + errors === 0 ? 0 : chars / (chars + errors);
}

/**
 * @param levelWords words typed since the last unlock (at least the trailing window)
 * @param wordsAtLevel true number of words typed at this level (drives stall relaxation)
 */
export function evaluatePromotion(
  levelWords: readonly WordResult[],
  wordsAtLevel: number,
  stats: KeyStatsMap,
  focus: readonly string[],
  cfg: PromotionConfig = DEFAULT_PROMOTION,
): PromotionStatus {
  const window = levelWords.slice(-cfg.windowWords);
  const overflow = wordsAtLevel - cfg.stallAfterWords;
  const relaxSteps = overflow > 0 ? Math.floor(overflow / cfg.relaxEveryWords) + 1 : 0;
  const accTarget = Math.max(cfg.accuracyFloor, cfg.minAccuracy - 0.01 * relaxSteps);
  const stabTarget = Math.max(cfg.stabilityFloor, cfg.minStability - 0.05 * relaxSteps);

  const acc = windowAccuracy(window);
  const stab = windowStability(window);

  // The weakest focus key decides. Accuracy uses the smoothed error rate, not
  // the lifetime ratio, so a rough start on a new key can't stall forever.
  const reps = Math.max(cfg.minFocusReps, MIN_SAMPLES);
  let focusProgress = 1;
  for (const c of focus) {
    const s = stats[c];
    let p = Math.min(1, (s?.clean ?? 0) / reps);
    if (p >= 1 && 1 - (s?.ewmaError ?? 1) < cfg.minFocusAccuracy) p = 0.99;
    focusProgress = Math.min(focusProgress, p);
  }

  const checks: PromotionCheck[] = [
    {
      id: 'window',
      label: 'Words at this level',
      value: window.length,
      target: cfg.windowWords,
      pass: window.length >= cfg.windowWords,
    },
    { id: 'accuracy', label: 'Accuracy', value: acc, target: accTarget, pass: acc >= accTarget },
    { id: 'stability', label: 'Rhythm stability', value: stab, target: stabTarget, pass: stab >= stabTarget },
    { id: 'focus', label: 'New key reps', value: focusProgress, target: 1, pass: focusProgress >= 1 },
  ];

  const progress = Math.min(...checks.map((c) => (c.target === 0 ? 1 : Math.min(1, c.value / c.target))));
  return { ready: checks.every((c) => c.pass), progress, relaxSteps, checks };
}
