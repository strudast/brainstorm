import type { GeoResult } from '../api/openMeteo';
import type { Place } from '../game/rules';

/** The "TV forecast" cities shown on the map at start — loaded in one request. */
export const OVERVIEW_CITIES: Place[] = [
  ['Athens', 'Greece', 37.98, 23.73],
  ['London', 'United Kingdom', 51.51, -0.13],
  ['Reykjavik', 'Iceland', 64.15, -21.94],
  ['Moscow', 'Russia', 55.76, 37.62],
  ['Cairo', 'Egypt', 30.04, 31.24],
  ['Lagos', 'Nigeria', 6.52, 3.38],
  ['Nairobi', 'Kenya', -1.29, 36.82],
  ['Cape Town', 'South Africa', -33.92, 18.42],
  ['Dubai', 'United Arab Emirates', 25.2, 55.27],
  ['Mumbai', 'India', 19.08, 72.88],
  ['Singapore', 'Singapore', 1.35, 103.82],
  ['Beijing', 'China', 39.9, 116.4],
  ['Tokyo', 'Japan', 35.68, 139.69],
  ['Sydney', 'Australia', -33.87, 151.21],
  ['Anchorage', 'United States', 61.22, -149.9],
  ['Vancouver', 'Canada', 49.28, -123.12],
  ['New York', 'United States', 40.71, -74.01],
  ['Mexico City', 'Mexico', 19.43, -99.13],
  ['Rio de Janeiro', 'Brazil', -22.91, -43.17],
  ['Buenos Aires', 'Argentina', -34.6, -58.38],
].map(([name, country, lat, lon]) => ({
  id: `overview:${name}`,
  name: name as string,
  country: country as string,
  lat: lat as number,
  lon: lon as number,
}));

export function placeFromGeo(g: GeoResult): Place {
  return {
    id: `geo:${g.id}`,
    name: g.name,
    country: g.country,
    countryCode: g.country_code,
    admin1: g.admin1,
    lat: g.latitude,
    lon: g.longitude,
  };
}

/** Open-Meteo has no reverse geocoding, so a map click becomes a coordinate "spot". */
export function placeFromPoint(lat: number, lon: number): Place {
  return {
    id: `pt:${lat.toFixed(2)},${lon.toFixed(2)}`,
    name: formatCoords(lat, lon),
    lat,
    lon,
  };
}

export function formatCoords(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
}

export function subtitle(p: Place, timezone?: string) {
  const parts = [p.admin1, p.country].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return timezone ? `Time zone: ${timezone.replace(/_/g, ' ')}` : 'Uncharted spot';
}

export const isOverview = (p: Place) => p.id.startsWith('overview:');
export const isHome = (p: Place) => p.id === 'home';

/** Local clock time from Open-Meteo's local ISO string ("2026-11-19T14:45"). */
export const localTime = (iso: string) => iso.slice(11, 16);
