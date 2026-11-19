import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category } from '../lib/weatherCodes';
import { ACHIEVEMENTS, QUESTS, levelFor, questsForDay, score, todayKey } from './rules';
import type { Discovery, Place, ScoreBreakdown } from './rules';

export interface Outcome {
  breakdown: ScoreBreakdown;
  questXp: number;
  completedQuests: string[];
  newAchievements: string[];
  levelUp: number | null;
}

interface DailyQuests {
  date: string;
  ids: string[];
  done: string[];
}

interface GameState {
  xp: number;
  streak: number;
  bestStreak: number;
  discoveries: Record<string, Discovery>;
  achievements: string[];
  quests: DailyQuests;
  home: Place | null;

  ensureDailyQuests: () => void;
  setHome: (p: Place) => void;
  recordDiscovery: (
    place: Place,
    guess: { temp: number; cat: Category },
    actual: Discovery['actual'],
  ) => Outcome;
  reset: () => void;
}

const freshQuests = (): DailyQuests => {
  const date = todayKey();
  return { date, ids: questsForDay(date), done: [] };
};

const initial = {
  xp: 0,
  streak: 0,
  bestStreak: 0,
  discoveries: {} as Record<string, Discovery>,
  achievements: [] as string[],
  quests: freshQuests(),
  home: null as Place | null,
};

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initial,

      ensureDailyQuests: () => {
        if (get().quests.date !== todayKey()) set({ quests: freshQuests() });
      },

      setHome: (home) => set({ home }),

      recordDiscovery: (place, guess, actual) => {
        get().ensureDailyQuests();
        const s = get();
        const breakdown = score(guess, actual, s.streak);
        const discovery: Discovery = { place, guess, actual, points: breakdown.total, at: Date.now() };

        const discoveries = { ...s.discoveries, [place.id]: discovery };
        const all = Object.values(discoveries);
        const today = all.filter((d) => todayKey(new Date(d.at)) === s.quests.date);

        const completedQuests = s.quests.ids.filter(
          (id) => !s.quests.done.includes(id) && QUESTS.find((q) => q.id === id)!.check(discovery, today),
        );
        const questXp = completedQuests.reduce((sum, id) => sum + QUESTS.find((q) => q.id === id)!.xp, 0);

        const newAchievements = ACHIEVEMENTS.filter(
          (a) => !s.achievements.includes(a.id) && a.check(all, discovery, breakdown.streak),
        ).map((a) => a.id);

        const xp = s.xp + breakdown.total + questXp;
        const before = levelFor(s.xp).level;
        const after = levelFor(xp).level;

        set({
          xp,
          streak: breakdown.streak,
          bestStreak: Math.max(s.bestStreak, breakdown.streak),
          discoveries,
          achievements: [...s.achievements, ...newAchievements],
          quests: { ...s.quests, done: [...s.quests.done, ...completedQuests] },
        });

        return { breakdown, questXp, completedQuests, newAchievements, levelUp: after > before ? after : null };
      },

      reset: () => set({ ...initial, quests: freshQuests() }),
    }),
    {
      name: 'brainstorm:game',
      version: 1,
      partialize: ({ xp, streak, bestStreak, discoveries, achievements, quests, home }) => ({
        xp,
        streak,
        bestStreak,
        discoveries,
        achievements,
        quests,
        home,
      }),
    },
  ),
);

/* ---------------- transient UI notifications ---------------- */

export interface Toast {
  id: number;
  emoji: string;
  title: string;
  body?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
