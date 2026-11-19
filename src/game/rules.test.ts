import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, QUESTS, clueFactor, haversineKm, levelFor, questsForDay, score } from './rules';
import type { Discovery } from './rules';

const disc = (over: Partial<Discovery['actual']> = {}, lat = 10, guess: Discovery['guess'] = { temp: 20, cat: 'clear' }): Discovery => ({
  place: { id: `p${Math.random()}`, name: 'X', lat, lon: 0 },
  guess,
  actual: { temp: 20, code: 0, cat: 'clear', isDay: true, wind: 5, ...over },
  points: 0,
  at: Date.now(),
});

describe('score', () => {
  it('gives 100 for a perfect guess', () => {
    const s = score({ temp: 20, cat: 'rain' }, { temp: 20, cat: 'rain' }, 0);
    expect(s.total).toBe(100);
    expect(s.good).toBe(true);
    expect(s.streak).toBe(1);
  });

  it('loses 6 points per degree and nothing for a wrong sky', () => {
    const s = score({ temp: 15, cat: 'snow' }, { temp: 20, cat: 'clear' }, 3);
    expect(s.tempPts).toBe(30);
    expect(s.catPts).toBe(0);
    expect(s.good).toBe(false);
    expect(s.streak).toBe(0); // streak broken
  });

  it('never goes below zero', () => {
    expect(score({ temp: -40, cat: 'snow' }, { temp: 40, cat: 'clear' }, 0).total).toBe(0);
  });

  it('applies a streak multiplier capped at 2x', () => {
    expect(score({ temp: 20, cat: 'clear' }, { temp: 20, cat: 'clear' }, 1).multiplier).toBe(1.25);
    expect(score({ temp: 20, cat: 'clear' }, { temp: 20, cat: 'clear' }, 20).multiplier).toBe(2);
  });

  it('reduces points close to a forecast city', () => {
    const s = score({ temp: 20, cat: 'clear' }, { temp: 20, cat: 'clear' }, 0, { name: 'Athens', km: 200 });
    expect(s.clueFactor).toBe(0.25);
    expect(s.total).toBe(25);
    expect(s.clue?.name).toBe('Athens');
  });

  it('ignores clues that are far away', () => {
    const s = score({ temp: 20, cat: 'clear' }, { temp: 20, cat: 'clear' }, 0, { name: 'Athens', km: 2000 });
    expect(s.clueFactor).toBe(1);
    expect(s.clue).toBeNull();
  });
});

describe('clueFactor', () => {
  it('scales linearly with a 0.25 floor', () => {
    expect(clueFactor(0)).toBe(0.25);
    expect(clueFactor(400)).toBe(0.5);
    expect(clueFactor(800)).toBe(1);
  });
});

describe('haversineKm', () => {
  it('measures Athens → London at roughly 2,390 km', () => {
    const km = haversineKm({ lat: 37.98, lon: 23.73 }, { lat: 51.51, lon: -0.13 });
    expect(km).toBeGreaterThan(2350);
    expect(km).toBeLessThan(2430);
  });
});

describe('levelFor', () => {
  it('uses quadratic thresholds', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'Light Breeze' });
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(400).level).toBe(3);
    expect(levelFor(1_000_000).title).toBe('Brainstorm');
  });
});

describe('questsForDay', () => {
  it('is deterministic and picks 3 distinct, valid quests', () => {
    const a = questsForDay('2026-11-19');
    expect(a).toEqual(questsForDay('2026-11-19'));
    expect(new Set(a).size).toBe(3);
    a.forEach((id) => expect(QUESTS.some((q) => q.id === id)).toBe(true));
  });

  it('varies across days', () => {
    const days = Array.from({ length: 10 }, (_, i) => questsForDay(`2026-12-${String(i + 1).padStart(2, '0')}`).join());
    expect(new Set(days).size).toBeGreaterThan(1);
  });
});

describe('quests & achievements', () => {
  const quest = (id: string) => QUESTS.find((q) => q.id === id)!;
  const ach = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

  it('detects a 30°C swing across today’s discoveries', () => {
    const hot = disc({ temp: 32 });
    const cold = disc({ temp: 1 });
    expect(quest('swing').check(cold, [hot, cold])).toBe(true);
    expect(quest('swing').check(cold, [cold])).toBe(false);
  });

  it('does not award guess-based rewards to peeks', () => {
    const peek = disc({}, 10, null);
    expect(quest('sharp').check(peek, [peek])).toBe(false);
    expect(ach('bullseye').check([peek], peek, 0)).toBe(false);
  });

  it('needs both hemispheres for Both Halves', () => {
    const n = disc({}, 40);
    const s = disc({}, -30);
    expect(ach('hemispheres').check([n], n, 0)).toBe(false);
    expect(ach('hemispheres').check([n, s], s, 0)).toBe(true);
  });
});
