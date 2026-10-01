import { useMemo } from 'react';
import { MAX_LEVEL, UNLOCK_ORDER, BASE_CHARS } from '../layout/colemakDh';
import { selectPromotion, useProfileStore } from '../state/profileStore';
import type { PromotionCheck } from '../engine/progression';

function formatCheck(c: PromotionCheck): string {
  switch (c.id) {
    case 'window':
      return `${c.value}/${c.target}`;
    case 'focus':
      return `${Math.round(c.value * 100)}%`;
    default:
      return `${(c.value * 100).toFixed(0)}% / ${(c.target * 100).toFixed(0)}%`;
  }
}

/** Level, unlocked key strip, and the live promotion checklist. */
export function ProgressPanel() {
  const unlockedCount = useProfileStore((s) => s.unlockedCount);
  const levelWords = useProfileStore((s) => s.levelWords);
  const wordsAtLevel = useProfileStore((s) => s.wordsAtLevel);
  const keyStats = useProfileStore((s) => s.keyStats);
  const settings = useProfileStore((s) => s.settings);
  const forceUnlock = useProfileStore((s) => s.forceUnlock);

  const status = useMemo(
    () => selectPromotion({ unlockedCount, levelWords, wordsAtLevel, keyStats, settings }),
    [unlockedCount, levelWords, wordsAtLevel, keyStats, settings],
  );
  const level = unlockedCount + 1;
  const next = UNLOCK_ORDER[unlockedCount];

  return (
    <section className="progress-panel">
      <div className="level">
        <span className="level-num">Level {level}</span>
        <span className="muted">of {MAX_LEVEL}</span>
      </div>

      <div className="key-strip" aria-label="Unlocked keys">
        {BASE_CHARS.map((c) => (
          <kbd key={c} className="unlocked">{c}</kbd>
        ))}
        {UNLOCK_ORDER.map((c, i) => (
          <kbd key={c} className={i < unlockedCount ? (i === unlockedCount - 1 ? 'unlocked newest' : 'unlocked') : 'locked'}>
            {c}
          </kbd>
        ))}
      </div>

      {next ? (
        <div className="promotion">
          <div className="promotion-head">
            <span>
              Next unlock: <kbd>{next}</kbd>
            </span>
            {status.relaxSteps > 0 && (
              <span className="relaxed" title="You've spent a while here, so thresholds are easing to prevent a stall">
                eased ×{status.relaxSteps}
              </span>
            )}
          </div>
          <div className="meter" role="progressbar" aria-valuenow={Math.round(status.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="meter-fill" style={{ width: `${status.progress * 100}%` }} />
          </div>
          <ul className="checks">
            {status.checks.map((c) => (
              <li key={c.id} className={c.pass ? 'pass' : 'todo'}>
                <span className="check-icon" aria-hidden>{c.pass ? '✓' : '○'}</span>
                {c.label} <span className="check-val">{formatCheck(c)}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="link" onClick={forceUnlock} title="Skip ahead if you already know this key">
            unlock now
          </button>
        </div>
      ) : (
        <div className="promotion done">All keys unlocked — keep practising to build speed.</div>
      )}
    </section>
  );
}
