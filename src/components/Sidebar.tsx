import type { Place } from '../game/rules';
import { ACHIEVEMENTS, QUESTS } from '../game/rules';
import { useGame } from '../game/store';
import { categoryMeta, emojiFor } from '../lib/weatherCodes';
import { tempColor } from '../lib/tempColor';

export function Quests() {
  const quests = useGame((s) => s.quests);
  return (
    <section className="card">
      <h3>📜 Today's quests</h3>
      <p className="muted small">New quests every day. Discover places to complete them.</p>
      <ul className="quests">
        {quests.ids.map((id) => {
          const q = QUESTS.find((x) => x.id === id)!;
          const done = quests.done.includes(id);
          return (
            <li key={id} className={done ? 'done' : ''}>
              <span className="q-emoji">{done ? '✅' : q.emoji}</span>
              <span>{q.title}</span>
              <span className="xp-pill">+{q.xp}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Your discovered world, ranked hottest → coldest — your own "world weather picture". */
export function Collection({ onSelect }: { onSelect: (p: Place) => void }) {
  const discoveries = useGame((s) => s.discoveries);
  const list = Object.values(discoveries).sort((a, b) => b.actual.temp - a.actual.temp);

  if (list.length === 0) {
    return (
      <section className="card empty">
        <h3>🗺️ Your world</h3>
        <p className="muted">Nothing yet. Click anywhere on the map, guess the weather, and it lands here.</p>
      </section>
    );
  }

  const hi = list[0].actual.temp;
  const lo = list[list.length - 1].actual.temp;
  const span = Math.max(1, hi - lo);

  return (
    <section className="card">
      <h3>🗺️ Your world · {list.length}</h3>
      <p className="muted small">
        Hottest to coldest — {Math.round(hi - lo)}° between your extremes.
      </p>
      <ul className="collection">
        {list.map((d) => (
          <li key={d.place.id}>
            <button onClick={() => onSelect(d.place)}>
              <span className="c-emoji">{emojiFor(d.actual.code, d.actual.isDay)}</span>
              <span className="c-name">
                {d.place.name}
                <small className="muted">{d.place.country ?? categoryMeta(d.actual.cat).label}</small>
              </span>
              <span className="c-bar">
                <i style={{ width: `${8 + ((d.actual.temp - lo) / span) * 92}%`, background: tempColor(d.actual.temp) }} />
              </span>
              <b>{Math.round(d.actual.temp)}°</b>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Badges() {
  const unlocked = useGame((s) => s.achievements);
  return (
    <section className="card">
      <h3>
        🏅 Badges · {unlocked.length}/{ACHIEVEMENTS.length}
      </h3>
      <ul className="badges">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.includes(a.id);
          return (
            <li key={a.id} className={got ? 'got' : 'locked'} title={a.description}>
              <span className="b-emoji">{got ? a.emoji : '🔒'}</span>
              <b>{a.title}</b>
              <small className="muted">{a.description}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
