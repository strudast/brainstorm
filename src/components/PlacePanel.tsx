import { useEffect, useState } from 'react';
import { getWeather } from '../api/openMeteo';
import type { Weather } from '../api/openMeteo';
import type { Discovery, Place } from '../game/rules';
import { ACHIEVEMENTS, QUESTS } from '../game/rules';
import { MAX_COMPARE, useGame, useToasts } from '../game/store';
import type { Outcome } from '../game/store';
import { CATEGORIES, categoryMeta, categoryOf, describe, emojiFor } from '../lib/weatherCodes';
import type { Category } from '../lib/weatherCodes';
import { isHome, isOverview, localTime, subtitle } from '../lib/places';
import { useCountUp } from '../lib/useCountUp';

/**
 * - New place  → guess temperature + sky, then reveal and score (or "Just show me").
 * - Forecast city / your location / already discovered → just show the weather.
 */
export function PlacePanel({ place, onClose, onCompare }: { place: Place; onClose: () => void; onCompare: () => void }) {
  const discovery = useGame((s) => s.discoveries[place.id]);
  // Decide the mode once, on open: recording a discovery mid-flow must not swap out the reveal screen.
  const [startedKnown] = useState(() => isOverview(place) || isHome(place) || !!discovery);
  const canCompare = startedKnown || !!discovery;

  return (
    <section className="card place">
      <header className="place-head">
        <div>
          <h2>
            {isHome(place) && '📍 '}
            {place.name}
          </h2>
          <p className="muted">{isHome(place) ? 'Your current location' : subtitle(place)}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close place">
          ✕
        </button>
      </header>
      {startedKnown ? <KnownWeather place={place} discovery={discovery} /> : <GuessFlow place={place} />}
      {canCompare && <CompareButton place={place} onCompare={onCompare} />}
    </section>
  );
}

function CompareButton({ place, onCompare }: { place: Place; onCompare: () => void }) {
  const compare = useGame((s) => s.compare);
  const toggle = useGame((s) => s.toggleCompare);
  const inList = compare.some((p) => p.id === place.id);
  return (
    <div className="compare-row">
      <button className="ghost" onClick={() => toggle(place)}>
        {inList ? '✓ In comparison' : `⚖️ Add to compare${compare.length >= MAX_COMPARE ? ' (replaces oldest)' : ''}`}
      </button>
      {compare.length >= 2 && (
        <button className="link" onClick={onCompare}>
          View comparison ({compare.length}) →
        </button>
      )}
    </div>
  );
}

/* ---------------- known places ---------------- */

function useWeather(place: Place) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getWeather(place.lat, place.lon)
      .then((w) => alive && setWeather(w))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [place.lat, place.lon]);
  return { weather, error };
}

function KnownWeather({ place, discovery }: { place: Place; discovery?: Discovery }) {
  const { weather, error } = useWeather(place);
  return (
    <>
      {discovery?.guess && (
        <div className="discovered-note">
          🏅 Discovered — you guessed <b>{discovery.guess.temp}°</b> {categoryMeta(discovery.guess.cat).emoji}, it was{' '}
          <b>{Math.round(discovery.actual.temp)}°</b> {categoryMeta(discovery.actual.cat).emoji} · <b>{discovery.points} pts</b>
        </div>
      )}
      {discovery && !discovery.guess && <div className="discovered-note peek">👀 Explored without guessing — no points.</div>}
      {isOverview(place) && <p className="hint">Forecast city — use these to read the map, then go find places nobody's shown you.</p>}
      {error && <p className="error">{error}</p>}
      {!weather && !error && <WeatherSkeleton />}
      {weather && <WeatherDetails weather={weather} />}
    </>
  );
}

/* ---------------- the guessing game ---------------- */

type Phase = 'guess' | 'loading' | 'revealed' | 'peeked' | 'error';

function GuessFlow({ place }: { place: Place }) {
  const record = useGame((s) => s.recordDiscovery);
  const recordPeek = useGame((s) => s.recordPeek);
  const pushToast = useToasts((s) => s.push);
  const [temp, setTemp] = useState(15);
  const [cat, setCat] = useState<Category | null>(null);
  const [phase, setPhase] = useState<Phase>('guess');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState('');

  const actualFrom = (w: Weather): Discovery['actual'] => ({
    temp: w.current.temperature,
    code: w.current.code,
    cat: categoryOf(w.current.code),
    isDay: w.current.isDay,
    wind: w.current.wind,
  });

  // Weather is fetched only on reveal/peek: no request is spent on places the player just clicks past.
  const load = async (mode: 'guess' | 'peek') => {
    setPhase('loading');
    try {
      const w = await getWeather(place.lat, place.lon);
      setWeather(w);
      if (mode === 'peek') {
        recordPeek(place, actualFrom(w));
        setPhase('peeked');
        return;
      }
      const o = record(place, { temp, cat: cat! }, actualFrom(w));
      setOutcome(o);
      setPhase('revealed');

      o.completedQuests.forEach((id) => {
        const q = QUESTS.find((x) => x.id === id)!;
        pushToast({ emoji: q.emoji, title: 'Quest complete!', body: `${q.title} · +${q.xp} XP` });
      });
      o.newAchievements.forEach((id) => {
        const a = ACHIEVEMENTS.find((x) => x.id === id)!;
        pushToast({ emoji: a.emoji, title: `Badge unlocked: ${a.title}`, body: a.description });
      });
      if (o.levelUp) pushToast({ emoji: '⚡', title: `Level ${o.levelUp}!`, body: 'Your storm is growing.' });
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  };

  if (phase === 'revealed' && weather && outcome) return <Reveal guess={{ temp, cat: cat! }} weather={weather} outcome={outcome} />;
  if (phase === 'peeked' && weather) return <WeatherDetails weather={weather} />;
  if (phase === 'loading') return <WeatherSkeleton />;

  return (
    <div className="guess">
      <p className="hint">What's the weather like here right now? Use the forecast cities around it as clues.</p>

      <label className="field-label" htmlFor="temp">
        Temperature <span className="temp-readout">{temp}°C</span>
      </label>
      <input
        id="temp"
        type="range"
        min={-40}
        max={50}
        step={1}
        value={temp}
        onChange={(e) => setTemp(Number(e.target.value))}
        className="temp-slider"
        aria-valuetext={`${temp} degrees Celsius`}
      />

      <span className="field-label" id="sky-label">
        Sky
      </span>
      <div className="cat-grid" role="radiogroup" aria-labelledby="sky-label">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={cat === c.id}
            className={`cat-btn ${cat === c.id ? 'active' : ''}`}
            onClick={() => setCat(c.id)}
          >
            <span aria-hidden>{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      {phase === 'error' && <p className="error">{error}</p>}
      <button className="primary" disabled={!cat} onClick={() => load('guess')}>
        {cat ? 'Reveal ⚡' : 'Pick a sky to reveal'}
      </button>
      <button className="skip" onClick={() => load('peek')}>
        Just show me the weather <span className="muted">(no points)</span>
      </button>
    </div>
  );
}

function Reveal({ guess, weather, outcome }: { guess: { temp: number; cat: Category }; weather: Weather; outcome: Outcome }) {
  const { breakdown: b } = outcome;
  const shownTemp = useCountUp(weather.current.temperature, 900);
  const shownPts = useCountUp(b.total + outcome.questXp, 1200, 400);
  const actualCat = categoryOf(weather.current.code);
  const verdict =
    b.diff < 0.5 ? 'Bullseye!' : b.base >= 85 ? 'Brilliant!' : b.base >= 60 ? 'Nice read!' : b.base >= 30 ? 'Not bad' : 'The sky fooled you';

  return (
    <div className="reveal">
      <div className="reveal-hero" aria-live="polite">
        <span className="reveal-emoji" aria-hidden>
          {emojiFor(weather.current.code, weather.current.isDay)}
        </span>
        <span className="reveal-temp">{shownTemp.toFixed(0)}°</span>
      </div>
      <p className="reveal-verdict">{verdict}</p>

      <table className="breakdown">
        <tbody>
          <tr>
            <td>
              Temperature · you said {guess.temp}°, off by {b.diff.toFixed(1)}°
            </td>
            <td>+{b.tempPts}</td>
          </tr>
          <tr>
            <td>
              Sky · you said {categoryMeta(guess.cat).emoji}, it's {categoryMeta(actualCat).emoji}
            </td>
            <td>+{b.catPts}</td>
          </tr>
          {b.multiplier > 1 && (
            <tr>
              <td>🔥 Streak ×{b.streak}</td>
              <td>×{b.multiplier}</td>
            </tr>
          )}
          {b.clue && (
            <tr>
              <td>
                🧭 Close to a clue ({b.clue.name}, {Math.round(b.clue.km)} km)
              </td>
              <td>×{b.clueFactor}</td>
            </tr>
          )}
          {outcome.questXp > 0 && (
            <tr>
              <td>📜 Quest bonus</td>
              <td>+{outcome.questXp}</td>
            </tr>
          )}
          <tr className="total">
            <td>Total</td>
            <td>+{Math.round(shownPts)} XP</td>
          </tr>
        </tbody>
      </table>
      {!b.good && <p className="muted small">Streak reset — score 60+ to keep it going.</p>}
      {b.clue && <p className="muted small">Go further from the forecast cities for full points.</p>}

      <WeatherDetails weather={weather} />
    </div>
  );
}

/* ---------------- shared ---------------- */

const weekday = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });

function WeatherSkeleton() {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-label="Loading weather">
      <div className="skeleton" style={{ height: 56, width: '55%' }} />
      <div className="skeleton" style={{ height: 48 }} />
      <div className="skeleton" style={{ height: 64 }} />
    </div>
  );
}

function WeatherDetails({ weather }: { weather: Weather }) {
  const c = weather.current;
  return (
    <>
      <div className="now">
        <div className="now-main">
          <span className="now-emoji" aria-hidden>
            {emojiFor(c.code, c.isDay)}
          </span>
          <div>
            <div className="now-temp">{Math.round(c.temperature)}°C</div>
            <div className="muted">{describe(c.code)}</div>
          </div>
        </div>
        <dl className="stats">
          <div>
            <dt>Feels like</dt>
            <dd>{Math.round(c.apparent)}°</dd>
          </div>
          <div>
            <dt>Wind</dt>
            <dd>{Math.round(c.wind)} km/h</dd>
          </div>
          <div>
            <dt>Humidity</dt>
            <dd>{c.humidity}%</dd>
          </div>
          <div>
            <dt>Local time</dt>
            <dd>
              {localTime(c.time)} {c.isDay ? '☀︎' : '☾'}
            </dd>
          </div>
        </dl>
      </div>
      <ol className="week" aria-label="7-day forecast">
        {weather.daily.map((d, i) => (
          <li key={d.date}>
            <span className="muted">{i === 0 ? 'Today' : weekday(d.date)}</span>
            <span className="week-emoji" title={describe(d.code)} aria-label={describe(d.code)}>
              {emojiFor(d.code)}
            </span>
            <b>{Math.round(d.max)}°</b>
            <span className="muted">{Math.round(d.min)}°</span>
          </li>
        ))}
      </ol>
    </>
  );
}
