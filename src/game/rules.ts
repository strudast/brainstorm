import type { Category } from '../lib/weatherCodes';

/* ---------------- domain types ---------------- */

export interface Place {
  id: string;
  name: string;
  country?: string;
  countryCode?: string;
  admin1?: string;
  lat: number;
  lon: number;
}

export interface Discovery {
  place: Place;
  guess: { temp: number; cat: Category };
  actual: { temp: number; code: number; cat: Category; isDay: boolean; wind: number };
  points: number;
  at: number; // epoch ms
}

/* ---------------- scoring ---------------- */

export interface ScoreBreakdown {
  diff: number;
  tempPts: number;
  catPts: number;
  base: number;
  multiplier: number;
  total: number;
  good: boolean;
  streak: number;
}

/**
 * Temperature: 60 pts for a perfect guess, minus 6 per degree off (0 at 10° off).
 * Condition: 40 pts if the category matches.
 * A "good" guess (>= 60 base) keeps the streak alive; every streak step adds +25%, capped at 2x.
 */
export function score(guess: { temp: number; cat: Category }, actual: { temp: number; cat: Category }, prevStreak: number): ScoreBreakdown {
  const diff = Math.abs(guess.temp - actual.temp);
  const tempPts = Math.max(0, Math.round(60 - 6 * diff));
  const catPts = guess.cat === actual.cat ? 40 : 0;
  const base = tempPts + catPts;
  const good = base >= 60;
  const streak = good ? prevStreak + 1 : 0;
  const multiplier = good ? 1 + Math.min(streak - 1, 4) * 0.25 : 1;
  return { diff, tempPts, catPts, base, multiplier, total: Math.round(base * multiplier), good, streak };
}

/* ---------------- levels ---------------- */

const TITLES = ['Light Breeze', 'Drizzle', 'Shower', 'Downpour', 'Thunderstorm', 'Supercell', 'Hurricane', 'Brainstorm'];

/** Level n starts at 100 * (n-1)^2 XP: 0, 100, 400, 900, ... */
export function levelFor(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const floor = 100 * (level - 1) ** 2;
  const next = 100 * level ** 2;
  return {
    level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    progress: (xp - floor) / (next - floor),
    toNext: next - xp,
  };
}

/* ---------------- daily quests ---------------- */

export interface QuestDef {
  id: string;
  emoji: string;
  title: string;
  xp: number;
  check: (d: Discovery, today: Discovery[]) => boolean;
}

export const QUESTS: QuestDef[] = [
  { id: 'rain', emoji: '🌧️', title: 'Find a place where it is raining right now', xp: 80, check: (d) => d.actual.cat === 'rain' },
  { id: 'snow', emoji: '❄️', title: 'Find a place where it is snowing right now', xp: 120, check: (d) => d.actual.cat === 'snow' },
  { id: 'storm', emoji: '⛈️', title: 'Catch a thunderstorm somewhere', xp: 150, check: (d) => d.actual.cat === 'storm' },
  { id: 'fog', emoji: '🌫️', title: 'Find somewhere foggy', xp: 120, check: (d) => d.actual.cat === 'fog' },
  { id: 'clear', emoji: '☀️', title: 'Find a place with clear skies', xp: 50, check: (d) => d.actual.cat === 'clear' },
  { id: 'hot', emoji: '🔥', title: 'Find somewhere at 30°C or hotter', xp: 80, check: (d) => d.actual.temp >= 30 },
  { id: 'freezing', emoji: '🧊', title: 'Find somewhere below freezing', xp: 80, check: (d) => d.actual.temp < 0 },
  { id: 'night', emoji: '🌙', title: 'Visit a place where it is night', xp: 50, check: (d) => !d.actual.isDay },
  { id: 'windy', emoji: '💨', title: 'Find wind of 30 km/h or more', xp: 100, check: (d) => d.actual.wind >= 30 },
  { id: 'south', emoji: '🧭', title: 'Explore the southern hemisphere', xp: 50, check: (d) => d.place.lat < 0 },
  { id: 'sharp', emoji: '🎯', title: 'Guess a temperature within 1°C', xp: 100, check: (d) => Math.abs(d.guess.temp - d.actual.temp) <= 1 },
  {
    id: 'swing',
    emoji: '🎢',
    title: 'Discover two places today that are 30°C apart',
    xp: 120,
    check: (_d, today) => {
      const t = today.map((x) => x.actual.temp);
      return t.length >= 2 && Math.max(...t) - Math.min(...t) >= 30;
    },
  },
  { id: 'trio', emoji: '🗺️', title: 'Discover 3 new places today', xp: 60, check: (_d, today) => today.length >= 3 },
];

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Deterministic pick of 3 quests per calendar day (same for everyone on the same date). */
export function questsForDay(key: string): string[] {
  let seed = [...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const ids = QUESTS.map((q) => q.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, 3);
}

/* ---------------- achievements ---------------- */

export interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  check: (all: Discovery[], latest: Discovery, streak: number) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', emoji: '🌱', title: 'First Forecast', description: 'Make your first guess', check: (all) => all.length >= 1 },
  { id: 'ten', emoji: '🧳', title: 'Explorer', description: 'Discover 10 places', check: (all) => all.length >= 10 },
  { id: 'twentyfive', emoji: '🌍', title: 'Globetrotter', description: 'Discover 25 places', check: (all) => all.length >= 25 },
  {
    id: 'bullseye',
    emoji: '🎯',
    title: 'Bullseye',
    description: 'Guess the exact temperature (within 0.5°C)',
    check: (_a, d) => Math.abs(d.guess.temp - d.actual.temp) < 0.5,
  },
  {
    id: 'hemispheres',
    emoji: '🌐',
    title: 'Both Halves',
    description: 'Discover places in both hemispheres',
    check: (all) => all.some((d) => d.place.lat > 0) && all.some((d) => d.place.lat < 0),
  },
  {
    id: 'extremes',
    emoji: '🌡️',
    title: 'Fire & Ice',
    description: 'Find a place at 35°C+ and one at −10°C or colder',
    check: (all) => all.some((d) => d.actual.temp >= 35) && all.some((d) => d.actual.temp <= -10),
  },
  {
    id: 'collector',
    emoji: '🃏',
    title: 'Full Deck',
    description: 'Collect all 6 kinds of weather',
    check: (all) => new Set(all.map((d) => d.actual.cat)).size >= 6,
  },
  { id: 'streak5', emoji: '🔥', title: 'On Fire', description: 'Reach a 5-guess streak', check: (_a, _d, s) => s >= 5 },
  {
    id: 'nightowl',
    emoji: '🦉',
    title: 'Night Owl',
    description: 'Discover 5 places where it is night',
    check: (all) => all.filter((d) => !d.actual.isDay).length >= 5,
  },
];
