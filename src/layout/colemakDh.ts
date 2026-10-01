/**
 * Colemak-DH (matrix / ortholinear variant) on a 3x5 + thumb split.
 *
 * Every key is identified by the KeyboardEvent.code of the *physical position*
 * it occupies (codes are named after the US-QWERTY legend at that position,
 * regardless of the OS layout). This file is the single source of truth for
 * position -> Colemak-DH character, hand, finger and row.
 */

export type Hand = 'left' | 'right';
export type Finger = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';
export type Row = 'top' | 'home' | 'bottom' | 'thumb';

export interface PhysicalKey {
  /** KeyboardEvent.code of the physical position (QWERTY-named). */
  code: string;
  /** Character Colemak-DH produces at this position. */
  char: string;
  hand: Hand;
  finger: Finger;
  row: Row;
  /** Visual column within the half, 0 = leftmost. */
  col: number;
  /** Resting position for the finger. */
  homing: boolean;
}

type RowSpec = ReadonlyArray<readonly [code: string, char: string]>;

const LEFT: Record<Exclude<Row, 'thumb'>, RowSpec> = {
  top: [['KeyQ', 'q'], ['KeyW', 'w'], ['KeyE', 'f'], ['KeyR', 'p'], ['KeyT', 'b']],
  home: [['KeyA', 'a'], ['KeyS', 'r'], ['KeyD', 's'], ['KeyF', 't'], ['KeyG', 'g']],
  bottom: [['KeyZ', 'z'], ['KeyX', 'x'], ['KeyC', 'c'], ['KeyV', 'd'], ['KeyB', 'v']],
};

const RIGHT: Record<Exclude<Row, 'thumb'>, RowSpec> = {
  top: [['KeyY', 'j'], ['KeyU', 'l'], ['KeyI', 'u'], ['KeyO', 'y'], ['KeyP', ';']],
  home: [['KeyH', 'm'], ['KeyJ', 'n'], ['KeyK', 'e'], ['KeyL', 'i'], ['Semicolon', 'o']],
  bottom: [['KeyN', 'k'], ['KeyM', 'h'], ['Comma', ','], ['Period', '.'], ['Slash', '/']],
};

const LEFT_FINGERS: Finger[] = ['pinky', 'ring', 'middle', 'index', 'index'];
const RIGHT_FINGERS: Finger[] = ['index', 'index', 'middle', 'ring', 'pinky'];

function buildHalf(hand: Hand, rows: typeof LEFT): PhysicalKey[] {
  const fingers = hand === 'left' ? LEFT_FINGERS : RIGHT_FINGERS;
  const homingCols = hand === 'left' ? [0, 1, 2, 3] : [1, 2, 3, 4];
  return (Object.keys(rows) as Array<keyof typeof rows>).flatMap((row) =>
    rows[row].map(([code, char], col) => ({
      code,
      char,
      hand,
      finger: fingers[col]!,
      row,
      col,
      homing: row === 'home' && homingCols.includes(col),
    })),
  );
}

export const SPACE_KEY: PhysicalKey = {
  code: 'Space',
  char: ' ',
  hand: 'right',
  finger: 'thumb',
  row: 'thumb',
  col: 0,
  homing: true,
};

export const LEFT_KEYS = buildHalf('left', LEFT);
export const RIGHT_KEYS = buildHalf('right', RIGHT);
export const ALL_KEYS: readonly PhysicalKey[] = [...LEFT_KEYS, ...RIGHT_KEYS, SPACE_KEY];

export const KEY_BY_CODE: ReadonlyMap<string, PhysicalKey> = new Map(ALL_KEYS.map((k) => [k.code, k]));
export const KEY_BY_CHAR: ReadonlyMap<string, PhysicalKey> = new Map(ALL_KEYS.map((k) => [k.char, k]));

/** Rows of a half in display order, for rendering. */
export function halfRows(hand: Hand): PhysicalKey[][] {
  const keys = hand === 'left' ? LEFT_KEYS : RIGHT_KEYS;
  return (['top', 'home', 'bottom'] as const).map((row) =>
    keys.filter((k) => k.row === row).sort((a, b) => a.col - b.col),
  );
}

export function fingerLabel(key: PhysicalKey): string {
  if (key.finger === 'thumb') return 'Thumb';
  return `${key.hand === 'left' ? 'Left' : 'Right'} ${key.finger}`;
}

/* ------------------------------------------------------------------ */
/* Progression order                                                   */
/* ------------------------------------------------------------------ */

/** Level 1: home-row foundation. */
export const BASE_CHARS: readonly string[] = ['a', 'r', 's', 't', 'h', 'n', 'e', 'i'];

/**
 * Each subsequent level unlocks exactly one character. The order balances
 * English letter frequency (so generated words stay fluid) against physical
 * adjacency to keys already learned (so each new reach is a small step).
 */
export const UNLOCK_ORDER: readonly string[] = [
  'o', // home, right pinky
  'd', // bottom, below t
  'l', // top, above n
  'u', // top, above e
  'c', // bottom, below s
  'm', // home, right inner index
  'p', // top, above t
  'f', // top, above s
  'g', // home, left inner index
  'w', // top, above r
  'y', // top, above i
  'b', // top, left inner index
  'v', // bottom, left inner index
  'k', // bottom, right inner index
  'j', // top, right inner index
  'x', // bottom, below r
  'z', // bottom, below a
  'q', // top, above a
];

export const MAX_LEVEL = 1 + UNLOCK_ORDER.length;

/** Characters available at a given number of unlocks beyond the base set. */
export function unlockedChars(unlockedCount: number): string[] {
  return [...BASE_CHARS, ...UNLOCK_ORDER.slice(0, unlockedCount)];
}

/** Keys the user is currently consolidating (gate promotion). */
export function focusChars(unlockedCount: number): string[] {
  return unlockedCount === 0 ? [...BASE_CHARS] : [UNLOCK_ORDER[unlockedCount - 1]!];
}
