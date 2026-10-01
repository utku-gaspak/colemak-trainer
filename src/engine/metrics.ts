/** Standard WPM: 5 characters = 1 word. */
export function wpm(chars: number, ms: number): number {
  if (ms <= 0 || chars <= 0) return 0;
  return chars / 5 / (ms / 60000);
}

/** Keystroke accuracy: correct presses over all presses. */
export function accuracy(correct: number, errors: number): number {
  const total = correct + errors;
  return total === 0 ? 1 : correct / total;
}

export function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdDev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
