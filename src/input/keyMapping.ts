import { KEY_BY_CHAR, KEY_BY_CODE, type PhysicalKey } from '../layout/colemakDh';

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
