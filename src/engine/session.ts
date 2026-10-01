/**
 * Pure typing-session state machine. No React, no timers: every transition is
 * `press(state, char, t)`, which makes the hot path trivially testable and
 * keeps the UI a thin projection of this state.
 *
 * Error model is "stop on error": a wrong press marks the current character
 * red and the cursor waits for the correct key. Characters typed right on the
 * first press end green; characters that needed correcting stay red.
 */
import type { Keystroke } from './keyStats';
import { LATENCY_CAP_MS } from './keyStats';
import type { WordResult } from './progression';
import { wpm } from './metrics';

export const CharState = {
  Pending: 0,
  Correct: 1,
  Corrected: 2,
} as const;
export type CharState = (typeof CharState)[keyof typeof CharState];

/** Cumulative counters across lessons in one sitting. */
export interface SessionTotals {
  correct: number;
  errors: number;
  /** Correct presses that have a measured interval (excludes run starts). */
  timedChars: number;
  activeMs: number;
}

export interface SessionState {
  words: string[];
  text: string;
  states: CharState[];
  cursor: number;
  /** Wrong presses on the character under the cursor. */
  pendingErrors: number;
  pendingWrong: string[];
  /** Index in `text` where the current word starts. */
  wordStart: number;
  wordStrokes: Keystroke[];
  lastCorrectT: number | null;
  lastPressT: number | null;
  /** Last wrong character typed, for the red "you pressed X" hint. */
  lastWrong: string | null;
  totals: SessionTotals;
}

export interface PressOutcome {
  state: SessionState;
  completedWord?: { result: WordResult; strokes: Keystroke[] };
  lessonComplete: boolean;
  correct: boolean;
}

export const EMPTY_TOTALS: SessionTotals = { correct: 0, errors: 0, timedChars: 0, activeMs: 0 };

export function createSession(words: string[], totals: SessionTotals = EMPTY_TOTALS): SessionState {
  const text = words.join(' ');
  return {
    words,
    text,
    states: new Array<CharState>(text.length).fill(CharState.Pending),
    cursor: 0,
    pendingErrors: 0,
    pendingWrong: [],
    wordStart: 0,
    wordStrokes: [],
    lastCorrectT: null,
    lastPressT: null,
    lastWrong: null,
    totals,
  };
}

export function isComplete(s: SessionState): boolean {
  return s.cursor >= s.text.length;
}

function capped(dt: number): number {
  return Math.min(Math.max(dt, 0), LATENCY_CAP_MS);
}

export function press(s: SessionState, char: string, t: number, now: number = Date.now()): PressOutcome {
  if (isComplete(s)) return { state: s, lessonComplete: true, correct: false };

  const target = s.text[s.cursor]!;
  const activeMs = s.totals.activeMs + (s.lastPressT === null ? 0 : capped(t - s.lastPressT));

  if (char !== target) {
    return {
      state: {
        ...s,
        pendingErrors: s.pendingErrors + 1,
        pendingWrong: [...s.pendingWrong, char],
        lastPressT: t,
        lastWrong: char,
        totals: { ...s.totals, errors: s.totals.errors + 1, activeMs },
      },
      lessonComplete: false,
      correct: false,
    };
  }

  const latency = s.lastCorrectT === null ? null : t - s.lastCorrectT;
  const stroke: Keystroke = { char: target, latency, errors: s.pendingErrors, wrong: s.pendingWrong };
  const states = s.states.slice();
  states[s.cursor] = s.pendingErrors === 0 ? CharState.Correct : CharState.Corrected;
  const cursor = s.cursor + 1;
  const wordStrokes = [...s.wordStrokes, stroke];

  let next: SessionState = {
    ...s,
    states,
    cursor,
    pendingErrors: 0,
    pendingWrong: [],
    wordStrokes,
    lastCorrectT: t,
    lastPressT: t,
    lastWrong: null,
    totals: {
      correct: s.totals.correct + 1,
      errors: s.totals.errors,
      timedChars: s.totals.timedChars + (latency === null ? 0 : 1),
      activeMs,
    },
  };

  // A word ends after its trailing space, or at the end of the text.
  const wordEnded = target === ' ' || cursor >= s.text.length;
  let completedWord: PressOutcome['completedWord'];
  if (wordEnded) {
    completedWord = { result: summariseWord(s.text.slice(s.wordStart, cursor), wordStrokes, now), strokes: wordStrokes };
    next = { ...next, wordStart: cursor, wordStrokes: [] };
  }

  return { state: next, completedWord, lessonComplete: cursor >= s.text.length, correct: true };
}

function summariseWord(slice: string, strokes: readonly Keystroke[], now: number): WordResult {
  let timed = 0;
  let durationMs = 0;
  let errors = 0;
  for (const k of strokes) {
    errors += k.errors;
    if (k.latency !== null) {
      timed++;
      durationMs += capped(k.latency);
    }
  }
  return { word: slice.trimEnd(), chars: slice.length, errors, durationMs, wpm: wpm(timed, durationMs), at: now };
}

/** Live session WPM, optionally including the in-progress idle gap. */
export function liveWpm(totals: SessionTotals): number {
  return wpm(totals.timedChars, totals.activeMs);
}
