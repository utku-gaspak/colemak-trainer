import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '../layout/colemakDh';
import { DEFAULT_SETTINGS, levelChange, type ProfileData } from '../state/profileStore';

const base = (over: Partial<ProfileData> = {}): ProfileData => ({
  unlockedCount: 0,
  keyStats: { a: { attempts: 5, clean: 5, misses: 0, ewmaLatency: 200, ewmaError: 0, recentLatencies: [], confusions: {}, lastSeen: 0 } },
  levelWords: [{ word: 'tan', chars: 4, errors: 0, durationMs: 500, wpm: 30, at: 0 }],
  wordsAtLevel: 1,
  totalWords: 1,
  lessons: [],
  unlocks: [],
  settings: DEFAULT_SETTINGS,
  ...over,
});

describe('levelChange', () => {
  it('jumps forward, recording each skipped unlock', () => {
    const out = levelChange(base(), 4, 1);
    expect(out.unlockedCount).toBe(3);
    expect(out.unlocks!.map((u) => u.char)).toEqual(['o', 'd', 'l']);
    expect(out.levelWords).toEqual([]);
    expect(out.wordsAtLevel).toBe(0);
  });

  it('goes back by re-locking keys and never touches key stats', () => {
    const fwd = { ...base(), ...levelChange(base(), 6, 1) };
    const back = levelChange(fwd, 2, 2);
    expect(back.unlockedCount).toBe(1);
    expect(back.unlocks!.map((u) => u.char)).toEqual(['o']);
    expect('keyStats' in back).toBe(false);
  });

  it('clamps out-of-range levels', () => {
    expect(levelChange(base(), 0, 0).unlockedCount).toBe(0);
    expect(levelChange(base(), 99, 0).unlockedCount).toBe(MAX_LEVEL - 1);
  });
});
