import { memo, useEffect, useRef } from 'react';
import { CharState } from '../engine/session';
import { useSessionStore } from '../state/sessionStore';

type Status = 'pending' | 'current' | 'error' | 'correct' | 'corrected';

/**
 * One character. Its selector returns a primitive, so a keypress re-renders
 * only the characters whose status actually changed (typically two).
 */
const Char = memo(function Char({ index, ch }: { index: number; ch: string }) {
  const status = useSessionStore((s): Status => {
    const st = s.session;
    if (index === st.cursor) return st.pendingErrors > 0 ? 'error' : 'current';
    const v = st.states[index];
    return v === CharState.Correct ? 'correct' : v === CharState.Corrected ? 'corrected' : 'pending';
  });
  const isSpace = ch === ' ';
  return (
    <span className={`ch ch-${status}${isSpace ? ' ch-space' : ''}`} data-index={index}>
      {isSpace ? ' ' : ch}
    </span>
  );
});

/** Red hint showing which key was actually pressed. */
function WrongHint() {
  const wrong = useSessionStore((s) => s.session.lastWrong);
  const tick = useSessionStore((s) => s.errorTick);
  if (wrong === null) return <div className="wrong-hint" aria-hidden />;
  return (
    <div className="wrong-hint visible" key={tick} role="status">
      pressed <kbd>{wrong === ' ' ? 'space' : wrong}</kbd>
    </div>
  );
}

export function TypingArea() {
  const words = useSessionStore((s) => s.session.words);
  const text = useSessionStore((s) => s.session.text);
  const errorTick = useSessionStore((s) => s.errorTick);
  const boxRef = useRef<HTMLDivElement>(null);

  // Replay the shake animation on every wrong press without re-rendering text.
  useEffect(() => {
    if (errorTick === 0) return;
    const el = boxRef.current;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }, [errorTick]);

  let offset = 0;
  return (
    <div className="typing-area" ref={boxRef}>
      {/* key={text} remounts on a new lesson so stale per-char subscriptions vanish */}
      <div className="text" key={text} aria-label={text}>
        {words.map((w, wi) => {
          const start = offset;
          const withSpace = wi < words.length - 1 ? `${w} ` : w;
          offset += withSpace.length;
          return (
            <span className="word" key={wi}>
              {[...withSpace].map((ch, ci) => (
                <Char key={ci} index={start + ci} ch={ch} />
              ))}
            </span>
          );
        })}
      </div>
      <WrongHint />
    </div>
  );
}
