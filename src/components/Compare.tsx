import { useEffect, useState } from 'react';
import { getWeather } from '../api/openMeteo';
import type { Weather } from '../api/openMeteo';
import type { Place } from '../game/rules';
import { useGame } from '../game/store';
import { describe, emojiFor } from '../lib/weatherCodes';
import { localTime } from '../lib/places';

const COLORS = ['#ffd23f', '#60a5fa', '#f472b6'];

/** Side-by-side view of up to 3 places: current conditions + 7-day highs/lows. */
export function Compare({ onSelect }: { onSelect: (p: Place) => void }) {
  const places = useGame((s) => s.compare);
  const toggle = useGame((s) => s.toggleCompare);
  const [data, setData] = useState<Record<string, Weather>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(places.map((p) => getWeather(p.lat, p.lon).then((w) => [p.id, w] as const)))
      .then((entries) => alive && setData(Object.fromEntries(entries)))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [places]);

  if (places.length < 2) {
    return (
      <section className="card empty">
        <h3>⚖️ Compare</h3>
        <p className="muted">
          Open any forecast city, your location or a place you've discovered and press <b>Add to compare</b>. Pick 2–3 places to see them side
          by side.
        </p>
        {places.length === 1 && <p className="small">Selected so far: {places[0].name}</p>}
      </section>
    );
  }

  const ready = places.every((p) => data[p.id]);
  const rows = places.map((p, i) => ({ place: p, weather: data[p.id], color: COLORS[i] }));

  return (
    <section className="card">
      <h3>⚖️ Compare</h3>
      {error && <p className="error">{error}</p>}
      {!ready && !error && <div className="skeleton" style={{ height: 180 }} />}
      {ready && (
        <>
          <Insight rows={rows} />
          <ul className="cmp-cards">
            {rows.map(({ place, weather, color }) => (
              <li key={place.id} style={{ borderTopColor: color }}>
                <button className="link cmp-name" onClick={() => onSelect(place)}>
                  {place.name}
                </button>
                <span className="cmp-now">
                  {emojiFor(weather.current.code, weather.current.isDay)} {Math.round(weather.current.temperature)}°
                </span>
                <small className="muted">{describe(weather.current.code)}</small>
                <small className="muted">
                  💨 {Math.round(weather.current.wind)} km/h · 🕒 {localTime(weather.current.time)}
                </small>
                <button className="icon-btn small" onClick={() => toggle(place)} aria-label={`Remove ${place.name} from comparison`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <TempChart rows={rows} />
        </>
      )}
    </section>
  );
}

type Row = { place: Place; weather: Weather; color: string };

function Insight({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => b.weather.current.temperature - a.weather.current.temperature);
  const hot = sorted[0];
  const cold = sorted[sorted.length - 1];
  const gap = Math.round(hot.weather.current.temperature - cold.weather.current.temperature);
  return (
    <p className="insight">
      {gap === 0 ? (
        <>Right now they're all about the same temperature.</>
      ) : (
        <>
          Right now <b>{hot.place.name}</b> is <b>{gap}°C warmer</b> than <b>{cold.place.name}</b>.
        </>
      )}
    </p>
  );
}

/** Hand-rolled SVG line chart: solid = daily high, dashed = daily low. */
function TempChart({ rows }: { rows: Row[] }) {
  const W = 340;
  const H = 170;
  const pad = { l: 28, r: 8, t: 10, b: 22 };
  const days = rows[0].weather.daily;
  const all = rows.flatMap((r) => r.weather.daily.flatMap((d) => [d.max, d.min]));
  const lo = Math.floor(Math.min(...all) / 5) * 5;
  const hi = Math.ceil(Math.max(...all) / 5) * 5 || lo + 5;
  const x = (i: number) => pad.l + (i / (days.length - 1)) * (W - pad.l - pad.r);
  const y = (t: number) => pad.t + (1 - (t - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: Math.floor((hi - lo) / 5) + 1 }, (_, i) => lo + i * 5).filter(
    (_, i, arr) => arr.length <= 6 || i % 2 === 0,
  );
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="7-day high and low temperatures for the compared places">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="axis">
              {t}°
            </text>
          </g>
        ))}
        {days.map((d, i) => (
          <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" className="axis">
            {i === 0 ? 'Today' : new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'narrow' })}
          </text>
        ))}
        {rows.map((r) => (
          <g key={r.place.id}>
            <path d={path(r.weather.daily.map((d) => d.min))} stroke={r.color} className="line dashed" />
            <path d={path(r.weather.daily.map((d) => d.max))} stroke={r.color} className="line" />
            {r.weather.daily.map((d, i) => (
              <circle key={d.date} cx={x(i)} cy={y(d.max)} r={2.5} fill={r.color}>
                <title>
                  {r.place.name} · {d.date}: {Math.round(d.max)}° / {Math.round(d.min)}°
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="muted small">Solid line: daily high · dashed: daily low</figcaption>
    </figure>
  );
}
