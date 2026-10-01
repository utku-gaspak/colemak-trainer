/**
 * Volatile typing session. Components subscribe to narrow slices (a single
 * character's state, the cursor), so a keypress re-renders only the two or
 * three characters whose state changed, not the whole lesson.
 */
import { create } from 'zustand';
import { createSession, EMPTY_TOTALS, press, type SessionState } from '../engine/session';
import { generateLesson } from '../engine/wordGenerator';
import { selectAllowed, selectFocus, selectWeakKeys, useProfileStore } from './profileStore';
import { accuracy, wpm } from '../engine/metrics';

interface SessionStore {
  session: SessionState;
  /** Key unlocked during this sitting, shown until dismissed. */
  justUnlocked: string | null;
  /** Bumped on every wrong press so the UI can replay a shake animation. */
  errorTick: number;
  lessonStartTotals: SessionState['totals'];
  type: (char: string, t: number) => void;
  nextLesson: () => void;
  restartLesson: () => void;
  resetSitting: () => void;
  dismissUnlock: () => void;
}

function buildWords(): string[] {
  const p = useProfileStore.getState();
  return generateLesson({
    allowed: selectAllowed(p),
    focus: selectFocus(p),
    weak: selectWeakKeys(p),
    wordCount: p.settings.lessonWords,
    weakBoost: p.settings.weakBoost,
  });
}

export const useSessionStore = create<SessionStore>()((set, get) => ({
  session: createSession(buildWords()),
  justUnlocked: null,
  errorTick: 0,
  lessonStartTotals: EMPTY_TOTALS,

  type: (char, t) => {
    const { session, errorTick, lessonStartTotals } = get();
    const out = press(session, char, t);
    if (!out.correct) {
      set({ session: out.state, errorTick: errorTick + 1 });
      return;
    }

    let unlocked: string | undefined;
    if (out.completedWord) {
      unlocked = useProfileStore.getState().recordWord(out.completedWord.result, out.completedWord.strokes);
    }

    if (out.lessonComplete) {
      const t1 = out.state.totals;
      const timed = t1.timedChars - lessonStartTotals.timedChars;
      const ms = t1.activeMs - lessonStartTotals.activeMs;
      useProfileStore.getState().recordLesson({
        at: Date.now(),
        wpm: wpm(timed, ms),
        accuracy: accuracy(t1.correct - lessonStartTotals.correct, t1.errors - lessonStartTotals.errors),
        chars: out.state.text.length,
        durationMs: ms,
      });
      // Roll straight into the next lesson; the new key (if any) appears now.
      set({
        session: createSession(buildWords(), t1),
        lessonStartTotals: t1,
        ...(unlocked ? { justUnlocked: unlocked } : {}),
      });
      return;
    }

    set({ session: out.state, ...(unlocked ? { justUnlocked: unlocked } : {}) });
  },

  nextLesson: () => {
    const totals = get().session.totals;
    set({ session: createSession(buildWords(), totals), lessonStartTotals: totals });
  },

  restartLesson: () => {
    const { session, lessonStartTotals } = get();
    set({ session: createSession(session.words, lessonStartTotals) });
  },

  resetSitting: () => set({ session: createSession(buildWords()), lessonStartTotals: EMPTY_TOTALS, justUnlocked: null }),

  dismissUnlock: () => set({ justUnlocked: null }),
}));
