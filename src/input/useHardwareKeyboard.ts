import { useEffect, useLayoutEffect, useRef } from 'react';
import type { PhysicalKey } from '../layout/colemakDh';
import { resolveChord, resolvePhysicalKey, type CodeMapping } from './keyMapping';

export interface PhysicalPress {
  /** Raw scancode from the event, e.g. `KeyF`. */
  code: string;
  /** Character produced (may come from a chord, e.g. AltGr + a → ä). */
  char: string;
  /** Physical key pressed, if it is part of the layout. */
  key?: PhysicalKey;
  /** High-resolution event timestamp (ms, monotonic). */
  t: number;
}

export interface HardwareKeyboardOptions {
  enabled: boolean;
  mapping: CodeMapping;
  /** Chord → character table from `buildChordMap`. */
  chords: ReadonlyMap<string, string>;
  onPress: (press: PhysicalPress) => void;
  /** Non-typing keys the trainer reacts to (e.g. Escape to restart). */
  onControl?: (code: string) => void;
}

const CONTROL_CODES = new Set(['Escape']);

/** Codes of modifier keys themselves; pressing one alone is never a chord. */
export const MODIFIER_CODES = new Set([
  'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight', 'CapsLock',
]);

/**
 * Is AltGr (or a plain Alt/Option) held? Linux and macOS report AltGr as the
 * `AltGraph` modifier; Windows reports it as Ctrl+Alt, which `altKey` covers.
 */
export function isAltGrHeld(e: KeyboardEvent): boolean {
  return e.getModifierState('AltGraph') || e.altKey;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Window-level keydown listener that reads only `event.code`.
 *
 * `event.key` is never consulted: the OS layout may remap characters, add dead
 * keys (US-International) or AltGr layers (EURkey), and none of that affects
 * `event.code`, which reports the physical position. Umlauts are recognised
 * as chords (physical key + AltGr state), also without `event.key`.
 *
 * Callbacks live in refs so the listener is attached once and never re-bound
 * while typing; keydown is the only work on the hot path.
 */
export function useHardwareKeyboard({ enabled, mapping, chords, onPress, onControl }: HardwareKeyboardOptions): void {
  const onPressRef = useRef(onPress);
  const onControlRef = useRef(onControl);
  const mappingRef = useRef(mapping);
  const chordsRef = useRef(chords);
  useLayoutEffect(() => {
    onPressRef.current = onPress;
    onControlRef.current = onControl;
    mappingRef.current = mapping;
    chordsRef.current = chords;
  });

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || isEditableTarget(e.target) || MODIFIER_CODES.has(e.code)) return;
      const altGr = isAltGrHeld(e);
      // Cmd and plain Ctrl are shortcuts, not typing. (Windows AltGr is Ctrl+Alt, so it passes.)
      if (e.metaKey || (e.ctrlKey && !altGr)) return;

      if (!altGr && CONTROL_CODES.has(e.code)) {
        e.preventDefault();
        onControlRef.current?.(e.code);
        return;
      }

      // Chords first: a rebinding may reuse an unmodified, otherwise-unmapped key.
      const mapping = mappingRef.current;
      const chordChar = resolveChord(chordsRef.current, { code: e.code, altGr });
      const key = resolvePhysicalKey(e.code, mapping);
      const char = chordChar ?? (altGr ? undefined : key?.char);
      if (char === undefined) return;

      // Swallow mapped keys so Space doesn't scroll and dead keys don't compose.
      e.preventDefault();
      // A focused button would otherwise be "clicked" by Space on keyup.
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) active.blur();
      if (e.repeat) return;

      onPressRef.current({ code: e.code, char, key, t: e.timeStamp });
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [enabled]);
}
