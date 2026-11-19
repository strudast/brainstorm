/**
 * Thin Open-Meteo client.
 *
 * Request budget matters (free tier), so:
 *  - forecasts are cached per ~11km grid cell (lat/lon rounded to 0.1°) for 15 minutes,
 *    in memory and in localStorage (survives reloads);
 *  - identical in-flight requests are de-duplicated;
 *  - the world overview loads all cities in ONE multi-location request;
 *  - geocoding results are cached in memory and the search box is debounced.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TTL_MS = 15 * 60 * 1000;
const LS_PREFIX = 'brainstorm:wx:';

const CURRENT_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'wind_speed_10m',
  'weather_code',
  'is_day',
].join(',');
const DAILY_VARS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
].join(',');

export interface CurrentWeather {
  time: string; // local time at the location, ISO without offset
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number; // km/h
  code: number; // WMO weather code
  isDay: boolean;
}

export interface DailyWeather {
  date: string;
  code: number;
  max: number;
  min: number;
  precipProb: number | null;
}

export interface Weather {
  current: CurrentWeather;
  daily: DailyWeather[];
  timezone: string;
  fetchedAt: number;
}

export interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  population?: number;
}

/* ---------------- cache helpers ---------------- */

const memCache = new Map<string, Weather>();
const inFlight = new Map<string, Promise<Weather>>();

export const cellKey = (lat: number, lon: number) => `${lat.toFixed(1)},${lon.toFixed(1)}`;

function readCache(key: string): Weather | null {
  const now = Date.now();
  const mem = memCache.get(key);
  if (mem && now - mem.fetchedAt < TTL_MS) return mem;
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw) as Weather;
      if (now - parsed.fetchedAt < TTL_MS) {
        memCache.set(key, parsed);
        return parsed;
      }
      localStorage.removeItem(LS_PREFIX + key);
    }
  } catch {
    /* storage unavailable or corrupt: ignore */
  }
  return null;
}

function writeCache(key: string, w: Weather) {
  memCache.set(key, w);
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(w));
  } catch {
    /* quota or private mode: memory cache still works */
  }
}

/* ---------------- parsing ---------------- */

interface RawForecast {
  timezone: string;
  current: Record<string, number | string>;
  daily: Record<string, (number | string | null)[]>;
}

function parseForecast(raw: RawForecast): Weather {
  const c = raw.current;
  const d = raw.daily;
  const dates = d.time as string[];
  return {
    timezone: raw.timezone,
    fetchedAt: Date.now(),
    current: {
      time: String(c.time),
      temperature: Number(c.temperature_2m),
      apparent: Number(c.apparent_temperature),
      humidity: Number(c.relative_humidity_2m),
      wind: Number(c.wind_speed_10m),
      code: Number(c.weather_code),
      isDay: Number(c.is_day) === 1,
    },
    daily: dates.map((date, i) => ({
      date,
      code: Number(d.weather_code[i]),
      max: Number(d.temperature_2m_max[i]),
      min: Number(d.temperature_2m_min[i]),
      precipProb: d.precipitation_probability_max?.[i] == null ? null : Number(d.precipitation_probability_max[i]),
    })),
  };
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok || (body && body.error)) {
    const reason = body?.reason ?? `HTTP ${res.status}`;
    throw new Error(res.status === 429 ? 'Too many requests — the weather service needs a breather. Try again in a minute.' : reason);
  }
  return body as T;
}

function forecastUrl(lats: number[], lons: number[]) {
  const p = new URLSearchParams({
    latitude: lats.map((v) => v.toFixed(2)).join(','),
    longitude: lons.map((v) => v.toFixed(2)).join(','),
    current: CURRENT_VARS,
    daily: DAILY_VARS,
    timezone: 'auto',
    forecast_days: '7',
  });
  return `${FORECAST_URL}?${p}`;
}

/* ---------------- public API ---------------- */

export function getCachedWeather(lat: number, lon: number): Weather | null {
  return readCache(cellKey(lat, lon));
}

export async function getWeather(lat: number, lon: number): Promise<Weather> {
  const key = cellKey(lat, lon);
  const cached = readCache(key);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const p = fetchJson<RawForecast>(forecastUrl([lat], [lon]))
    .then((raw) => {
      const w = parseForecast(raw);
      writeCache(key, w);
      return w;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

/** Fetch many points in a single request, skipping anything already cached. */
export async function getWeatherMany(points: { lat: number; lon: number }[]): Promise<(Weather | null)[]> {
  const result: (Weather | null)[] = points.map((p) => readCache(cellKey(p.lat, p.lon)));
  const missing = points.map((p, i) => ({ ...p, i })).filter((p) => !result[p.i]);
  if (missing.length === 0) return result;

  const raw = await fetchJson<RawForecast | RawForecast[]>(
    forecastUrl(
      missing.map((m) => m.lat),
      missing.map((m) => m.lon),
    ),
  );
  const list = Array.isArray(raw) ? raw : [raw];
  list.forEach((r, j) => {
    const m = missing[j];
    if (!m) return;
    const w = parseForecast(r);
    writeCache(cellKey(m.lat, m.lon), w);
    result[m.i] = w;
  });
  return result;
}

const geoCache = new Map<string, GeoResult[]>();

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hit = geoCache.get(q);
  if (hit) return hit;
  const p = new URLSearchParams({ name: q, count: '6', language: 'en', format: 'json' });
  const body = await fetchJson<{ results?: GeoResult[] }>(`${GEOCODING_URL}?${p}`, signal);
  const results = body.results ?? [];
  geoCache.set(q, results);
  return results;
}
