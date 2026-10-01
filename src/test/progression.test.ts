import { describe, expect, it } from 'vitest';
import { applyKeystrokes, type Keystroke } from '../engine/keyStats';
import { DEFAULT_PROMOTION, evaluatePromotion, type WordResult } from '../engine/progression';

const word = (wpm: number, errors = 0): WordResult => ({ word: 'tan', chars: 4, errors, durationMs: 500, wpm, at: 0 });
const reps = (char: string, n: number, errors = 0): Keystroke[] =>
  Array.from({ length: n }, () => ({ char, latency: 250, errors, wrong: errors ? ['x'] : [] }));

describe('evaluatePromotion', () => {
  const stats = applyKeystrokes({}, reps('o', 20), 0);

  it('promotes on accurate, steady typing with enough focus reps', () => {
    const words = Array.from({ length: 20 }, (_, i) => word(30 + (i % 3)));
    expect(evaluatePromotion(words, 20, stats, ['o']).ready).toBe(true);
  });

  it('does not promote with too few words, low accuracy, or erratic rhythm', () => {
    expect(evaluatePromotion([word(30)], 1, stats, ['o']).ready).toBe(false);
    const sloppy = Array.from({ length: 20 }, () => word(30, 1));
    expect(evaluatePromotion(sloppy, 20, stats, ['o']).checks.find((c) => c.id === 'accuracy')!.pass).toBe(false);
    const erratic = Array.from({ length: 20 }, (_, i) => word(i % 2 ? 10 : 60));
    expect(evaluatePromotion(erratic, 20, stats, ['o']).checks.find((c) => c.id === 'stability')!.pass).toBe(false);
  });

  it('requires reps on the focus key only — weak old keys never block', () => {
    const words = Array.from({ length: 20 }, () => word(30));
    const weakOld = applyKeystrokes(stats, reps('s', 30, 2), 0);
    expect(evaluatePromotion(words, 20, weakOld, ['o']).ready).toBe(true);
    expect(evaluatePromotion(words, 20, stats, ['d']).ready).toBe(false);
  });

  it('relaxes thresholds after a long stall', () => {
    // 94% accuracy (940 / 1000 presses): fails at 95%, passes once eased.
    const words = Array.from({ length: 20 }, () => ({ ...word(30), chars: 47, errors: 3 }));
    expect(evaluatePromotion(words, 20, stats, ['o']).ready).toBe(false);
    const late = evaluatePromotion(words, DEFAULT_PROMOTION.stallAfterWords + 100, stats, ['o']);
    expect(late.relaxSteps).toBeGreaterThan(0);
    expect(late.ready).toBe(true);
  });
});
