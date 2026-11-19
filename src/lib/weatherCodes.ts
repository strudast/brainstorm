/** WMO weather interpretation codes, as used by Open-Meteo. */

export type Category = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'clear', label: 'Clear', emoji: '☀️' },
  { id: 'cloudy', label: 'Cloudy', emoji: '☁️' },
  { id: 'fog', label: 'Fog', emoji: '🌫️' },
  { id: 'rain', label: 'Rain', emoji: '🌧️' },
  { id: 'snow', label: 'Snow', emoji: '❄️' },
  { id: 'storm', label: 'Storm', emoji: '⛈️' },
];

const LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
};

export function describe(code: number): string {
  return LABELS[code] ?? 'Unknown';
}

export function categoryOf(code: number): Category {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
}

export function emojiFor(code: number, isDay = true): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code === 1) return isDay ? '🌤️' : '🌙';
  if (code === 2) return isDay ? '⛅' : '☁️';
  return CATEGORIES.find((c) => c.id === categoryOf(code))!.emoji;
}

export function categoryMeta(cat: Category) {
  return CATEGORIES.find((c) => c.id === cat)!;
}
