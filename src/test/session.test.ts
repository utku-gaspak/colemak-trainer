import { describe, expect, it } from 'vitest';
import { CharState, createSession, press } from '../engine/session';

function typeAll(chars: string, start = createSession(['tan', 'he']), dt = 200) {
  let s = start;
  let t = 1000;
  const words = [];
  for (const c of chars) {
    const out = press(s, c, t, 0);
    s = out.state;
    if (out.completedWord) words.push(out.completedWord);
    t += dt;
  }
  return { s, words };
}

describe('session', () => {
  it('advances on correct presses and reports words with trailing spaces', () => {
    const { s, words } = typeAll('tan he');
    expect(s.cursor).toBe(6);
    expect(words.map((w) => w.result.word)).toEqual(['tan', 'he']);
    expect(words[0]!.result.chars).toBe(4);
    expect(s.states.every((v) => v === CharState.Correct)).toBe(true);
  });

  it('stops on error and marks the corrected character', () => {
    const { s, words } = typeAll('txan');
    expect(s.cursor).toBe(3);
    expect(s.states[1]).toBe(CharState.Corrected);
    expect(s.totals.errors).toBe(1);
    expect(words).toHaveLength(0);
    const { words: w2 } = typeAll('txan ');
    expect(w2[0]!.strokes[1]).toMatchObject({ char: 'a', errors: 1, wrong: ['x'] });
    expect(w2[0]!.result.errors).toBe(1);
  });

  it('computes word wpm from inter-key latency (first key untimed)', () => {
    const { words } = typeAll('tan ', undefined, 240); // 240ms/char = 50 wpm
    expect(words[0]!.result.wpm).toBeCloseTo(50, 5);
    expect(words[0]!.strokes[0]!.latency).toBeNull();
  });

  it('caps long pauses in active time', () => {
    let s = createSession(['ab']);
    s = press(s, 'a', 0, 0).state;
    s = press(s, 'b', 60_000, 0).state;
    expect(s.totals.activeMs).toBe(1500);
  });
});
