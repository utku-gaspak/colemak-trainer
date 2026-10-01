import { EXTRA_CHARS, KEY_BY_CHAR, KEY_BY_CODE, type PhysicalKey } from '../layout/colemakDh';

/**
 * How physical presses arrive from the keyboard:
 *
 * - `positional`: the board sends standard QWERTY-position scancodes and the
 *   Colemak-DH remap happens here. `KeyF` -> `t`. This is the spec default and
 *   works no matter what the OS layout is (EURkey, US-Intl, ...).
 * - `firmware`: the board's firmware (QMK/ZMK/Vial) already emits Colemak-DH
 *   keycodes, so pressing the "t" position sends `KeyT`. We then resolve the
 *   code by its QWERTY legend and look the character up. Still independent of
 *   the OS layout, because `event.code` never passes through it.
 */
export type CodeMapping = 'positional' | 'firmware';

/** The US-QWERTY legend that each KeyboardEvent.code is named after. */
const QWERTY_LEGEND: Readonly<Record<string, string>> = (() => {
  const map: Record<string, string> = {
    Semicolon: ';',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Space: ' ',
  };
  for (let c = 97; c <= 122; c++) {
    const ch = String.fromCharCode(c);
    map[`Key${ch.toUpperCase()}`] = ch;
  }
  return map;
})();

export function resolvePhysicalKey(code: string, mapping: CodeMapping): PhysicalKey | undefined {
  if (mapping === 'positional') return KEY_BY_CODE.get(code);
  const legend = QWERTY_LEGEND[code];
  return legend === undefined ? undefined : KEY_BY_CHAR.get(legend);
}

/* ------------------------------------------------------------------ */
/* Chords: characters typed with a modifier (umlauts)                  */
/* ------------------------------------------------------------------ */

/** A physical key plus whether AltGr (or Alt/Option) is held. */
export interface Chord {
  code: string;
  altGr: boolean;
}

export type ChordOverrides = Readonly<Partial<Record<string, Chord>>>;

/** AltGr + the key that types the base letter under the current mapping. */
export function defaultChord(char: string, mapping: CodeMapping): Chord | undefined {
  const extra = EXTRA_CHARS.get(char);
  if (!extra) return undefined;
  const code = mapping === 'positional' ? KEY_BY_CHAR.get(extra.base)?.code : `Key${extra.base.toUpperCase()}`;
  return code ? { code, altGr: true } : undefined;
}

export function effectiveChord(char: string, mapping: CodeMapping, overrides: ChordOverrides): Chord | undefined {
  return overrides[char] ?? defaultChord(char, mapping);
}

const chordId = (c: Chord) => `${c.altGr ? 'altgr+' : ''}${c.code}`;

/** Lookup table chord → character, checked before the plain key mapping. */
export function buildChordMap(mapping: CodeMapping, overrides: ChordOverrides): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const char of EXTRA_CHARS.keys()) {
    const chord = effectiveChord(char, mapping, overrides);
    if (chord) map.set(chordId(chord), char);
  }
  return map;
}

export function resolveChord(chordMap: ReadonlyMap<string, string>, chord: Chord): string | undefined {
  return chordMap.get(chordId(chord));
}

/** Human-readable chord, naming the key by what it types (e.g. "AltGr + a"). */
export function describeChord(chord: Chord, mapping: CodeMapping): string {
  const key = resolvePhysicalKey(chord.code, mapping);
  const name = key ? (key.char === ' ' ? 'space' : key.char) : chord.code.replace(/^Key/, '');
  return chord.altGr ? `AltGr + ${name}` : name;
}

export interface CharGuide {
  /** Physical key to press (undefined if a rebinding uses a key outside the layout). */
  key?: PhysicalKey;
  altGr: boolean;
  /** e.g. "t", "space", "AltGr + a". */
  label: string;
}

/** How to type `char` on this setup: which key, and whether AltGr is needed. */
export function guideFor(char: string, mapping: CodeMapping, overrides: ChordOverrides): CharGuide | undefined {
  const chord = effectiveChord(char, mapping, overrides);
  if (chord) return { key: resolvePhysicalKey(chord.code, mapping), altGr: chord.altGr, label: describeChord(chord, mapping) };
  const key = KEY_BY_CHAR.get(char);
  if (!key) return undefined;
  return { key, altGr: false, label: key.char === ' ' ? 'space' : key.char };
}

/** Small labels for keycaps that also type a chord character (a → ä). */
export function chordLabels(chars: Iterable<string>, mapping: CodeMapping, overrides: ChordOverrides): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of chars) {
    if (!EXTRA_CHARS.has(c)) continue;
    const g = guideFor(c, mapping, overrides);
    if (g?.key && g.altGr) out[g.key.char] = c;
  }
  return out;
}
