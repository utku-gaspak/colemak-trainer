/**
 * Persisted learner profile (localStorage). Updated once per completed word,
 * never per keystroke, so persistence never touches the keydown hot path.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CodeMapping } from '../input/keyMapping';
import { focusChars, UNLOCK_ORDER, unlockedChars } from '../layout/colemakDh';
import { applyKeystrokes, findWeakKeys, type Keystroke, type KeyStatsMap, type WeakKey } from '../engine/keyStats';
import {
  DEFAULT_PROMOTION,
  evaluatePromotion,
  type PromotionConfig,
  type PromotionStatus,
  type WordResult,
} from '../engine/progression';

export interface Settings {
  mapping: CodeMapping;
  targetWpm: number;
  lessonWords: number;
  weakBoost: number;
  showKeyboard: boolean;
  promotion: PromotionConfig;
}

export interface LessonSummary {
  at: number;
  level: number;
  wpm: number;
  accuracy: number;
  chars: number;
  durationMs: number;
}

export interface UnlockEvent {
  char: string;
  at: number;
  /** Words it took at the previous level. */
  words: number;
}

interface ProfileData {
  unlockedCount: number;
  keyStats: KeyStatsMap;
  /** Words since the last unlock (capped), the promotion window source. */
  levelWords: WordResult[];
  wordsAtLevel: number;
  totalWords: number;
  lessons: LessonSummary[];
  unlocks: UnlockEvent[];
  settings: Settings;
}

interface ProfileActions {
  /** Returns the newly unlocked character, if this word triggered promotion. */
  recordWord: (result: WordResult, strokes: readonly Keystroke[]) => string | undefined;
  recordLesson: (summary: Omit<LessonSummary, 'level'>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Manual skip, for users who already know a key. */
  forceUnlock: () => string | undefined;
  resetProgress: () => void;
}

export type ProfileState = ProfileData & ProfileActions;

const LEVEL_WORDS_LIMIT = 400;
const LESSONS_LIMIT = 1000;

export const DEFAULT_SETTINGS: Settings = {
  mapping: 'positional',
  targetWpm: 35,
  lessonWords: 15,
  weakBoost: 0.3,
  showKeyboard: true,
  promotion: DEFAULT_PROMOTION,
};

const initialData = (): ProfileData => ({
  unlockedCount: 0,
  keyStats: {},
  levelWords: [],
  wordsAtLevel: 0,
  totalWords: 0,
  lessons: [],
  unlocks: [],
  settings: DEFAULT_SETTINGS,
});

function unlockNext(s: ProfileData, now: number): Partial<ProfileData> | undefined {
  const char = UNLOCK_ORDER[s.unlockedCount];
  if (!char) return undefined;
  return {
    unlockedCount: s.unlockedCount + 1,
    levelWords: [],
    wordsAtLevel: 0,
    unlocks: [...s.unlocks, { char, at: now, words: s.wordsAtLevel }],
  };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      recordWord: (result, strokes) => {
        const s = get();
        const keyStats = applyKeystrokes(s.keyStats, strokes, result.at);
        const levelWords = [...s.levelWords, result].slice(-LEVEL_WORDS_LIMIT);
        const wordsAtLevel = s.wordsAtLevel + 1;
        const updated = { ...s, keyStats, levelWords, wordsAtLevel, totalWords: s.totalWords + 1 };

        const status = selectPromotion(updated);
        const unlock = status.ready ? unlockNext(updated, result.at) : undefined;

        set({ keyStats, levelWords, wordsAtLevel, totalWords: updated.totalWords, ...unlock });
        return unlock ? UNLOCK_ORDER[s.unlockedCount] : undefined;
      },

      recordLesson: (summary) =>
        set((s) => ({ lessons: [...s.lessons, { ...summary, level: s.unlockedCount + 1 }].slice(-LESSONS_LIMIT) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      forceUnlock: () => {
        const s = get();
        const unlock = unlockNext(s, Date.now());
        if (!unlock) return undefined;
        set(unlock);
        return UNLOCK_ORDER[s.unlockedCount];
      },

      resetProgress: () => set((s) => ({ ...initialData(), settings: s.settings })),
    }),
    {
      name: 'kegex.profile',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ recordWord, recordLesson, updateSettings, forceUnlock, resetProgress, ...data }) => data,
      // Shallow merge drops newly added settings fields from old saves; merge settings deeply.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProfileData>;
        return {
          ...current,
          ...p,
          settings: {
            ...current.settings,
            ...p.settings,
            promotion: { ...current.settings.promotion, ...p.settings?.promotion },
          },
        };
      },
    },
  ),
);

/* ---------------- derived selectors ---------------- */

export function selectAllowed(s: ProfileData): string[] {
  return unlockedChars(s.unlockedCount);
}

export function selectFocus(s: ProfileData): string[] {
  return focusChars(s.unlockedCount);
}

export function selectWeakKeys(s: ProfileData): WeakKey[] {
  return findWeakKeys(s.keyStats, unlockedChars(s.unlockedCount), s.settings.targetWpm);
}

export function selectPromotion(
  s: Pick<ProfileData, 'levelWords' | 'wordsAtLevel' | 'keyStats' | 'unlockedCount' | 'settings'>,
): PromotionStatus {
  return evaluatePromotion(s.levelWords, s.wordsAtLevel, s.keyStats, focusChars(s.unlockedCount), s.settings.promotion);
}
