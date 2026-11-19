// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_COMPARE, useGame } from './store';
import type { Place } from './rules';

const place = (id: string, lat = 0, lon = -150): Place => ({ id, name: id, lat, lon }); // mid-Pacific: far from every clue city
const actual = { temp: 20, code: 0, cat: 'clear' as const, isDay: true, wind: 5 };

beforeEach(() => {
  localStorage.clear();
  useGame.getState().reset();
});

describe('game store', () => {
  it('records a guess, adds XP and unlocks the first badge', () => {
    const o = useGame.getState().recordDiscovery(place('a'), { temp: 20, cat: 'clear' }, actual);
    const s = useGame.getState();
    expect(o.breakdown.total).toBe(100);
    expect(s.xp).toBe(100 + o.questXp);
    expect(s.streak).toBe(1);
    expect(s.achievements).toContain('first');
    expect(o.levelUp).toBe(2);
  });

  it('penalises guesses right next to a forecast city', () => {
    const athens = place('near-athens', 38, 23.8);
    const o = useGame.getState().recordDiscovery(athens, { temp: 20, cat: 'clear' }, actual);
    expect(o.breakdown.clue?.name).toBe('Athens');
    expect(o.breakdown.total).toBeLessThan(100);
  });

  it('records a peek with no game effects', () => {
    useGame.getState().recordPeek(place('p'), actual);
    const s = useGame.getState();
    expect(s.discoveries.p.guess).toBeNull();
    expect(s.xp).toBe(0);
    expect(s.achievements).toEqual([]);
  });

  it('peeks do not count towards discovery badges', () => {
    useGame.getState().recordPeek(place('p1'), actual);
    const o = useGame.getState().recordDiscovery(place('g1'), { temp: 0, cat: 'snow' }, actual);
    expect(o.newAchievements).toContain('first');
    expect(o.newAchievements).not.toContain('ten');
  });

  it('keeps at most 3 places in the comparison, dropping the oldest', () => {
    const { toggleCompare } = useGame.getState();
    ['a', 'b', 'c', 'd'].forEach((id) => toggleCompare(place(id)));
    expect(useGame.getState().compare.map((p) => p.id)).toEqual(['b', 'c', 'd']);
    expect(useGame.getState().compare).toHaveLength(MAX_COMPARE);
    toggleCompare(place('c'));
    expect(useGame.getState().compare.map((p) => p.id)).toEqual(['b', 'd']);
  });

  it('persists progress to localStorage', () => {
    useGame.getState().recordDiscovery(place('a'), { temp: 20, cat: 'clear' }, actual);
    const saved = JSON.parse(localStorage.getItem('brainstorm:game')!);
    expect(saved.state.xp).toBeGreaterThan(0);
    expect(Object.keys(saved.state.discoveries)).toEqual(['a']);
  });
});

describe('anti-farming', () => {
  it('penalises guessing right next to a place you already discovered', () => {
    const { recordDiscovery, recordPeek } = useGame.getState();
    recordPeek(place('seen', 0, -150), actual);
    const o = recordDiscovery(place('next-door', 0.01, -150.01), { temp: 20, cat: 'clear' }, actual);
    expect(o.breakdown.clue?.name).toBe('seen');
    expect(o.breakdown.clueFactor).toBe(0.25);
  });

  it('penalises guessing next to your own location', () => {
    const { setHome, recordDiscovery } = useGame.getState();
    setHome({ id: 'home', name: 'My weather', lat: 0, lon: -150 });
    const o = recordDiscovery(place('nearby', 0.05, -150), { temp: 20, cat: 'clear' }, actual);
    expect(o.breakdown.clue?.name).toBe('your location');
  });
});
