import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { TempGrid, Weather } from '../api/openMeteo';
import { TempLayer } from './TempLayer';
import type { Discovery, Place } from '../game/rules';
import { emojiFor } from '../lib/weatherCodes';
import { haversineKm } from '../game/rules';

interface Props {
  overview: { place: Place; weather: Weather | null }[];
  discoveries: Discovery[];
  home: { place: Place; weather: Weather | null } | null;
  selected: Place | null;
  tempGrid: TempGrid | null;
  onPick: (lat: number, lon: number) => void;
  onSelect: (p: Place) => void;
}

const chip = (cls: string, emoji: string, label: string) =>
  L.divIcon({
    className: 'chip-icon',
    html: `<div class="chip ${cls}"><span>${emoji}</span><b>${label}</b></div>`,
    iconSize: [0, 0],
  });

const mystery = L.divIcon({ className: 'chip-icon', html: '<div class="chip mystery"><b>?</b></div>', iconSize: [0, 0] });

function ClickHandler({ onPick }: { onPick: Props['onPick'] }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng.wrap();
      onPick(lat, lng);
    },
  });
  return null;
}

function FlyTo({ target }: { target: Place | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 5), { duration: 1.2 });
  }, [target, map]);
  return null;
}

export function WorldMap({ overview, discoveries, home, selected, tempGrid, onPick, onSelect }: Props) {
  const discoveredIds = new Set(discoveries.map((d) => d.place.id));
  const showMystery = selected && !discoveredIds.has(selected.id) && !selected.id.startsWith('overview:') && selected.id !== 'home';

  return (
    <MapContainer center={[25, 10]} zoom={2} minZoom={2} worldCopyJump className="map" zoomControl={false}>
      {/* Standard OSM tiles: keyless. Darkened with a CSS filter (.dark-tiles) to match the theme. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        className="dark-tiles"
      />
      {tempGrid && <TempLayer grid={tempGrid} />}
      <ClickHandler onPick={onPick} />
      <FlyTo target={selected} />

      {overview.map(({ place, weather }) =>
        // Hide a forecast city sitting under your own location marker (e.g. you're in Athens).
        weather && !(home && haversineKm(home.place, place) < 50) ? (
          <Marker
            key={place.id}
            position={[place.lat, place.lon]}
            icon={chip('known', emojiFor(weather.current.code, weather.current.isDay), `${Math.round(weather.current.temperature)}°`)}
            eventHandlers={{ click: () => onSelect(place) }}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              {place.name}
            </Tooltip>
          </Marker>
        ) : null,
      )}

      {discoveries.map((d) => (
        <Marker
          key={d.place.id}
          position={[d.place.lat, d.place.lon]}
          icon={chip('found', emojiFor(d.actual.code, d.actual.isDay), `${Math.round(d.actual.temp)}°`)}
          eventHandlers={{ click: () => onSelect(d.place) }}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            {d.place.name} · {d.points} pts
          </Tooltip>
        </Marker>
      ))}

      {home && (
        <Marker
          position={[home.place.lat, home.place.lon]}
          icon={chip(
            'home',
            '📍',
            home.weather ? `${Math.round(home.weather.current.temperature)}°` : 'You',
          )}
          eventHandlers={{ click: () => onSelect(home.place) }}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            You are here
          </Tooltip>
        </Marker>
      )}

      {showMystery && <Marker position={[selected.lat, selected.lon]} icon={mystery} interactive={false} />}
    </MapContainer>
  );
}
