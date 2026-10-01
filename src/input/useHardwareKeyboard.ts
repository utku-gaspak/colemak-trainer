import { useEffect, useLayoutEffect, useRef } from 'react';
import type { PhysicalKey } from '../layout/colemakDh';
import { resolvePhysicalKey, type CodeMapping } from './keyMapping';

export interface PhysicalPress {
  /** Raw scancode from the event, e.g. `KeyF`. */
  code: string;
  key: PhysicalKey;
  /** High-resolution event timestamp (ms, monotonic). */
  t: number;
}

export interface HardwareKeyboardOptions {
  enabled: boolean;
  mapping: CodeMapping;
  onPress: (press: PhysicalPress) => void;
  /** Non-typing keys the trainer reacts to (e.g. Escape to restart). */
  onControl?: (code: string) => void;
}

const CONTROL_CODES = new Set(['Escape']);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Window-level keydown listener that reads only `event.code`.
 *
 * `event.key` is never consulted: the OS layout may remap characters, add dead
 * keys (US-International) or AltGr layers (EURkey), and none of that affects
 * `event.code`, which reports the physical position.
 *
 * Callbacks live in refs so the listener is attached once and never re-bound
 * while typing; keydown is the only work on the hot path.
 */
export function useHardwareKeyboard({ enabled, mapping, onPress, onControl }: HardwareKeyboardOptions): void {
  const onPressRef = useRef(onPress);
  const onControlRef = useRef(onControl);
  const mappingRef = useRef(mapping);
  useLayoutEffect(() => {
    onPressRef.current = onPress;
    onControlRef.current = onControl;
    mappingRef.current = mapping;
  });

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || isEditableTarget(e.target)) return;
      // Shortcuts (and AltGr, which reports ctrl+alt on Windows) are not typing.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (CONTROL_CODES.has(e.code)) {
        e.preventDefault();
        onControlRef.current?.(e.code);
        return;
      }

      const key = resolvePhysicalKey(e.code, mappingRef.current);
      if (!key) return;

      // Swallow mapped keys so Space doesn't scroll and dead keys don't compose.
      e.preventDefault();
      // A focused button would otherwise be "clicked" by Space on keyup.
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) active.blur();
      if (e.repeat) return;

      onPressRef.current({ code: e.code, key, t: e.timeStamp });
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [enabled]);
}
