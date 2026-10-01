/**
 * Per-key performance tracking.
 *
 * Latency and error rate are exponentially weighted moving averages, so a key
 * that was weak last week but is fine today recovers quickly instead of being
 * dragged down by its lifetime average (one of Keybr's stall sources).
 */

/** One completed target character. */
export interface Keystroke {
  char: string;
  /** ms since the previous correct press; null for the first key of a run. */
  latency: number | null;
  /** Wrong presses before the correct one. */
  errors: number;
  /** Characters produced by the wrong presses. */
  wrong: string[];
}

export interface KeyStat {
  attempts: number;
  /** Attempts typed correctly on the first press. */
  clean: number;
  /** Total wrong presses while this key was the target. */
  misses: number;
  ewmaLatency: number | null;
  /** Smoothed probability that an attempt contains an error (0..1). */
  ewmaError: number;
  /** Most recent clean latencies, newest last (for sparklines/history). */
  recentLatencies: number[];
  /** What was pressed instead of this key, with counts. */
  confusions: Record<string, number>;
  lastSeen: number;
}

export type KeyStatsMap = Record<string, KeyStat>;

const LATENCY_ALPHA = 0.15;
const ERROR_ALPHA = 0.1;
/** Gaps longer than this are pauses, not typing speed. */
export const LATENCY_CAP_MS = 1500;
const RECENT_LATENCY_LIMIT = 40;
/** Below this many attempts, a key's confidence is not yet meaningful. */
export const MIN_SAMPLES = 8;

export function emptyKeyStat(): KeyStat {
  return {
    attempts: 0,
    clean: 0,
    misses: 0,
    ewmaLatency: null,
    ewmaError: 0,
    recentLatencies: [],
    confusions: {},
    lastSeen: 0,
  };
}

export function applyKeystroke(stat: KeyStat, ks: Keystroke, now: number): KeyStat {
  const isClean = ks.errors === 0;
  const next: KeyStat = {
    ...stat,
    attempts: stat.attempts + 1,
    clean: stat.clean + (isClean ? 1 : 0),
    misses: stat.misses + ks.errors,
    ewmaError: ERROR_ALPHA * (isClean ? 0 : 1) + (1 - ERROR_ALPHA) * stat.ewmaError,
    lastSeen: now,
  };

  if (ks.wrong.length > 0) {
    const confusions = { ...stat.confusions };
    for (const w of ks.wrong) confusions[w] = (confusions[w] ?? 0) + 1;
    next.confusions = confusions;
  }

  // Only clean presses measure speed; an errored press includes correction time.
  if (isClean && ks.latency !== null && ks.latency > 0 && ks.latency <= LATENCY_CAP_MS) {
    next.ewmaLatency =
      stat.ewmaLatency === null ? ks.latency : LATENCY_ALPHA * ks.latency + (1 - LATENCY_ALPHA) * stat.ewmaLatency;
    next.recentLatencies = [...stat.recentLatencies, Math.round(ks.latency)].slice(-RECENT_LATENCY_LIMIT);
  }
  return next;
}

export function applyKeystrokes(stats: KeyStatsMap, strokes: readonly Keystroke[], now: number): KeyStatsMap {
  const next = { ...stats };
  for (const ks of strokes) {
    if (ks.char === ' ') continue; // space is tracked by word metrics, not key confidence
    next[ks.char] = applyKeystroke(next[ks.char] ?? emptyKeyStat(), ks, now);
  }
  return next;
}

export function targetLatencyMs(targetWpm: number): number {
  return 60000 / (targetWpm * 5);
}

/**
 * 0..1 mastery score: speed relative to target, penalised quadratically by
 * error rate (accuracy matters more than speed while learning a layout).
 */
export function keyConfidence(stat: KeyStat | undefined, targetWpm: number): number {
  if (!stat || stat.attempts < MIN_SAMPLES || stat.ewmaLatency === null) return 0;
  const speed = Math.min(1, targetLatencyMs(targetWpm) / stat.ewmaLatency);
  const acc = 1 - stat.ewmaError;
  return speed * acc * acc;
}

export function keyErrorRate(stat: KeyStat | undefined): number {
  if (!stat || stat.attempts === 0) return 0;
  return stat.misses / (stat.attempts + stat.misses);
}

export interface WeakKey {
  char: string;
  /** 0..1, higher = weaker. */
  weakness: number;
}

export const WEAK_CONFIDENCE = 0.8;

/**
 * The few weakest *measured* keys. Limiting to the top N keeps injection
 * meaningful: if every key were "weak", boosting all of them would be a no-op.
 */
export function findWeakKeys(
  stats: KeyStatsMap,
  chars: readonly string[],
  targetWpm: number,
  limit = 3,
): WeakKey[] {
  return chars
    .filter((c) => (stats[c]?.attempts ?? 0) >= MIN_SAMPLES)
    .map((c) => ({ char: c, weakness: 1 - keyConfidence(stats[c], targetWpm) }))
    .filter((k) => k.weakness > 1 - WEAK_CONFIDENCE)
    .sort((a, b) => b.weakness - a.weakness)
    .slice(0, limit);
}
