import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category } from '../lib/weatherCodes';
import { OVERVIEW_CITIES } from '../lib/places';
import { ACHIEVEMENTS, QUESTS, levelFor, nearest, questsForDay, score, todayKey } from './rules';
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
  compare: Place[];

  ensureDailyQuests: () => void;
  setHome: (p: Place) => void;
  recordDiscovery: (
    place: Place,
    guess: { temp: number; cat: Category },
    actual: Discovery['actual'],
  ) => Outcome;
  /** "Just show me": the place joins your world, but with no points, quests or badges. */
  recordPeek: (place: Place, actual: Discovery['actual']) => void;
  toggleCompare: (place: Place) => void;
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
  compare: [] as Place[],
};

export const MAX_COMPARE = 3;

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
        const near = nearest(place, OVERVIEW_CITIES);
        const breakdown = score(guess, actual, s.streak, near ? { name: near.item.name, km: near.km } : null);
        const discovery: Discovery = { place, guess, actual, points: breakdown.total, at: Date.now() };

        const discoveries = { ...s.discoveries, [place.id]: discovery };
        // Peeks don't count towards the game.
        const all = Object.values(discoveries).filter((d) => d.guess);
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

      recordPeek: (place, actual) =>
        set((s) => ({
          discoveries: { ...s.discoveries, [place.id]: { place, guess: null, actual, points: 0, at: Date.now() } },
        })),

      toggleCompare: (place) =>
        set((s) =>
          s.compare.some((p) => p.id === place.id)
            ? { compare: s.compare.filter((p) => p.id !== place.id) }
            : { compare: [...s.compare, place].slice(-MAX_COMPARE) },
        ),

      reset: () => set({ ...initial, quests: freshQuests() }),
    }),
    {
      name: 'brainstorm:game',
      version: 1,
      partialize: ({ xp, streak, bestStreak, discoveries, achievements, quests, home, compare }) => ({
        xp,
        streak,
        bestStreak,
        discoveries,
        achievements,
        quests,
        home,
        compare,
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
