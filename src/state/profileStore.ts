/**
 * Persisted learner profile (localStorage). Updated once per completed word,
 * never per keystroke, so persistence never touches the keydown hot path.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ChordOverrides, CodeMapping } from '../input/keyMapping';
import { isThemeId, type ThemeId } from '../themes/themes';
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
  theme: ThemeId;
  mapping: CodeMapping;
  /** Per-character chord rebindings (umlauts); unset = AltGr + base letter. */
  chords: ChordOverrides;
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

export interface ProfileData {
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
  /** Jump to any level, forward or back. Key stats are kept. */
  setLevel: (level: number) => void;
  resetProgress: () => void;
}

export type ProfileState = ProfileData & ProfileActions;

const LEVEL_WORDS_LIMIT = 400;
const LESSONS_LIMIT = 1000;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  mapping: 'positional',
  chords: {},
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

/**
 * Move to `level` (1-based). Key stats and history are never touched: going
 * back just re-locks keys, going forward unlocks them. The promotion window
 * restarts because it measures performance at the current level only.
 */
export function levelChange(s: ProfileData, level: number, now: number): Partial<ProfileData> {
  const count = Math.max(0, Math.min(UNLOCK_ORDER.length, Math.round(level) - 1));
  const kept = s.unlocks.filter((u) => UNLOCK_ORDER.indexOf(u.char) < count);
  const added = UNLOCK_ORDER.slice(s.unlockedCount, count).map((char, i) => ({
    char,
    at: now,
    words: i === 0 ? s.wordsAtLevel : 0,
  }));
  return { unlockedCount: count, levelWords: [], wordsAtLevel: 0, unlocks: [...kept, ...added] };
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

      setLevel: (level) => {
        const s = get();
        if (Math.round(level) - 1 === s.unlockedCount) return;
        set(levelChange(s, level, Date.now()));
      },

      resetProgress: () => set((s) => ({ ...initialData(), settings: s.settings })),
    }),
    {
      name: 'kegex.profile',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ recordWord, recordLesson, updateSettings, setLevel, resetProgress, ...data }) => data,
      // Shallow merge drops newly added settings fields from old saves; merge settings deeply.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProfileData>;
        const settings: Settings = {
          ...current.settings,
          ...p.settings,
          promotion: { ...current.settings.promotion, ...p.settings?.promotion },
        };
        // A theme removed in a later version falls back to system.
        if (!isThemeId(settings.theme)) settings.theme = 'system';
        return { ...current, ...p, settings };
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
