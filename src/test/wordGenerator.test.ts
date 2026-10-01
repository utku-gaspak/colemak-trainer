import { describe, expect, it } from 'vitest';
import { BASE_CHARS, unlockedChars } from '../layout/colemakDh';
import { createRng } from '../engine/rng';
import { generateLesson } from '../engine/wordGenerator';

describe('generateLesson', () => {
  it('uses only unlocked characters at every level', () => {
    for (let n = 0; n <= 18; n++) {
      const allowed = unlockedChars(n);
      const words = generateLesson({ allowed, wordCount: 50, rng: createRng(n + 1) });
      const set = new Set(allowed);
      for (const w of words) for (const c of w) expect(set.has(c)).toBe(true);
    }
  });

  it('produces pronounceable words from the base home-row set', () => {
    const words = generateLesson({ allowed: BASE_CHARS, wordCount: 200, rng: createRng(7) });
    const vowelless = words.filter((w) => !/[aei]/.test(w));
    expect(vowelless.length / words.length).toBeLessThan(0.1);
    expect(words.some((w) => /(.)\1\1/.test(w))).toBe(false);
  });

  it('boosts the focus key at the character level', () => {
    const allowed = unlockedChars(2); // + o, d
    const count = (focus: string[]) =>
      generateLesson({ allowed, focus, wordCount: 400, rng: createRng(3) }).join('').split('d').length - 1;
    expect(count(['d'])).toBeGreaterThan(count([]) * 1.5);
  });

  it('weights words containing weak keys ~30% more often', () => {
    const allowed = unlockedChars(6);
    const share = (boost: number) => {
      let hits = 0;
      const N = 3000;
      const words = generateLesson({ allowed, weak: [{ char: 'c', weakness: 0.5 }], weakBoost: boost, wordCount: N, rng: createRng(11) });
      for (const w of words) if (w.includes('c')) hits++;
      return hits / N;
    };
    const base = share(0);
    const boosted = share(0.3);
    expect(boosted / base).toBeGreaterThan(1.15);
    expect(boosted / base).toBeLessThan(1.35);
  });
});
