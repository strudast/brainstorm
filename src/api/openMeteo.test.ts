// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTemperatureGrid, getWeather, getWeatherMany, searchPlaces } from './openMeteo';

const raw = (temp: number) => ({
  timezone: 'Europe/Athens',
  current: { time: '2026-11-19T14:45', temperature_2m: temp, apparent_temperature: temp, relative_humidity_2m: 50, wind_speed_10m: 10, weather_code: 3, is_day: 1 },
  daily: {
    time: ['2026-11-19'],
    weather_code: [3],
    temperature_2m_max: [temp + 2],
    temperature_2m_min: [temp - 2],
    precipitation_probability_max: [20],
  },
});

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

// The module keeps an in-memory cache, so each test uses its own coordinates.

describe('getWeather', () => {
  it('parses the response and caches it', async () => {
    fetchMock.mockImplementation(() => ok(raw(18)));
    const w = await getWeather(10, 10);
    expect(w.current.temperature).toBe(18);
    expect(w.current.isDay).toBe(true);
    expect(w.daily[0]).toMatchObject({ max: 20, min: 16, precipProb: 20 });

    await getWeather(10.02, 10.03); // same ~11 km cell
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('de-duplicates concurrent requests', async () => {
    fetchMock.mockImplementation(() => ok(raw(5)));
    await Promise.all([getWeather(20, 20), getWeather(20, 20), getWeather(20, 20)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses localStorage after the memory cache is gone', async () => {
    fetchMock.mockImplementation(() => ok(raw(7)));
    await getWeather(30, 30);
    vi.resetModules();
    const fresh = await import('./openMeteo');
    const w = await fresh.getWeather(30, 30);
    expect(w.current.temperature).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns a 429 into a friendly message', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: true, reason: 'limit' }), { status: 429 })));
    await expect(getWeather(40, 40)).rejects.toThrow(/Too many requests/);
  });
});

describe('getWeatherMany', () => {
  it('fetches all missing points in one request and skips cached ones', async () => {
    fetchMock.mockImplementationOnce(() => ok(raw(1)));
    await getWeather(50, 50);

    fetchMock.mockImplementationOnce(() => ok([raw(2), raw(3)]));
    const res = await getWeatherMany([
      { lat: 50, lon: 50 },
      { lat: 51, lon: 51 },
      { lat: 52, lon: 52 },
    ]);
    expect(res.map((w) => w?.current.temperature)).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const url = new URL(fetchMock.mock.calls[1][0]);
    expect(url.searchParams.get('latitude')).toBe('51.00,52.00');
  });
});

describe('getTemperatureGrid', () => {
  it('requests 180 points at once and caches the grid', async () => {
    fetchMock.mockImplementation(() => ok(Array.from({ length: 180 }, (_, i) => ({ current: { temperature_2m: i } }))));
    const g = await getTemperatureGrid();
    expect(g.temps).toHaveLength(10);
    expect(g.temps[0]).toHaveLength(18);
    expect(g.temps[1][0]).toBe(18);
    await getTemperatureGrid();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('searchPlaces', () => {
  it('skips queries shorter than 2 characters', async () => {
    expect(await searchPlaces('a')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches results per query', async () => {
    fetchMock.mockImplementation(() => ok({ results: [{ id: 1, name: 'Athens', latitude: 37.98, longitude: 23.73 }] }));
    await searchPlaces('Athens');
    const r = await searchPlaces('  athens ');
    expect(r[0].name).toBe('Athens');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
