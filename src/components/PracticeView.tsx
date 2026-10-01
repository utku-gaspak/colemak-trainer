import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHardwareKeyboard, type PhysicalPress } from '../input/useHardwareKeyboard';
import { fingerLabel, KEY_BY_CHAR } from '../layout/colemakDh';
import { selectAllowed, selectFocus, selectWeakKeys, useProfileStore } from '../state/profileStore';
import { useSessionStore } from '../state/sessionStore';
import { useShallow } from 'zustand/shallow';
import { FingerLegend, SplitKeyboard } from './SplitKeyboard';
import { MetricsBar } from './MetricsBar';
import { ProgressPanel } from './ProgressPanel';
import { TypingArea } from './TypingArea';

function useWindowFocused(): boolean {
  const [focused, setFocused] = useState(() => document.hasFocus());
  useEffect(() => {
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    window.addEventListener('focus', on);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('focus', on);
      window.removeEventListener('blur', off);
    };
  }, []);
  return focused;
}

/** Guide keyboard: subscribes to the target char only, not the whole session. */
function KeyboardGuide({ showCodes }: { showCodes: boolean }) {
  const target = useSessionStore((s) => s.session.text[s.session.cursor]);
  const wrong = useSessionStore((s) => s.session.lastWrong);
  const allowed = useProfileStore(useShallow(selectAllowed));
  const focus = useProfileStore(useShallow(selectFocus));
  const unlocked = useMemo(() => new Set(allowed), [allowed]);
  const focusSet = useMemo(() => new Set(focus), [focus]);
  const targetKey = target === undefined ? undefined : KEY_BY_CHAR.get(target);

  return (
    <section className="keyboard-panel" aria-label="Keyboard guide">
      <SplitKeyboard target={target} wrong={wrong} unlocked={unlocked} focus={focusSet} showCodes={showCodes} />
      <div className="keyboard-caption">
        <span className="finger-hint">
          {targetKey ? (
            <>
              Next: <kbd>{targetKey.char === ' ' ? 'space' : targetKey.char}</kbd> · {fingerLabel(targetKey)}
            </>
          ) : (
            ' '
          )}
        </span>
        <FingerLegend active={targetKey} />
      </div>
    </section>
  );
}

function WeakKeysBadge() {
  const weak = useProfileStore(useShallow((s) => selectWeakKeys(s).map((w) => w.char)));
  if (weak.length === 0) return null;
  return (
    <div className="weak-keys" title="Words containing these keys are weighted ~30% more often until they recover">
      Reinforcing: {weak.map((c) => <kbd key={c}>{c}</kbd>)}
    </div>
  );
}

export function PracticeView({ active }: { active: boolean }) {
  const mapping = useProfileStore((s) => s.settings.mapping);
  const showKeyboard = useProfileStore((s) => s.settings.showKeyboard);
  const type = useSessionStore((s) => s.type);
  const restartLesson = useSessionStore((s) => s.restartLesson);
  const justUnlocked = useSessionStore((s) => s.justUnlocked);
  const dismissUnlock = useSessionStore((s) => s.dismissUnlock);
  const focused = useWindowFocused();
  const [showCodes, setShowCodes] = useState(false);

  const onPress = useCallback((p: PhysicalPress) => type(p.key.char, p.t), [type]);
  const onControl = useCallback((code: string) => code === 'Escape' && restartLesson(), [restartLesson]);
  useHardwareKeyboard({ enabled: active, mapping, onPress, onControl });

  useEffect(() => {
    if (!justUnlocked) return;
    const id = window.setTimeout(dismissUnlock, 6000);
    return () => window.clearTimeout(id);
  }, [justUnlocked, dismissUnlock]);

  return (
    <div className="practice">
      <ProgressPanel />
      <MetricsBar />
      {justUnlocked && (
        <div className="unlock-toast" role="status">
          New key unlocked: <kbd>{justUnlocked}</kbd> · {fingerLabel(KEY_BY_CHAR.get(justUnlocked)!)}
        </div>
      )}
      <div className={`typing-shell${focused ? '' : ' blurred'}`}>
        <TypingArea />
        {!focused && <div className="focus-overlay">Click here to resume typing</div>}
      </div>
      <div className="practice-hints">
        <WeakKeysBadge />
        <span className="muted">
          <kbd>Esc</kbd> restart line ·{' '}
          <button type="button" className="link" onClick={() => setShowCodes((v) => !v)}>
            {showCodes ? 'hide' : 'show'} scancodes
          </button>
        </span>
      </div>
      {showKeyboard && <KeyboardGuide showCodes={showCodes} />}
    </div>
  );
}
