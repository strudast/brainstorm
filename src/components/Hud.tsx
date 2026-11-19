import { levelFor } from '../game/rules';
import { useGame, useToasts } from '../game/store';

export function Hud({ onLocate, locating }: { onLocate: () => void; locating: boolean }) {
  const xp = useGame((s) => s.xp);
  const streak = useGame((s) => s.streak);
  const count = useGame((s) => Object.keys(s.discoveries).length);
  const lvl = levelFor(xp);

  return (
    <header className="hud">
      <div className="brand">
        <span className="bolt">⚡</span>
        <h1>Brainstorm</h1>
      </div>

      <div className="level" title={`${lvl.toNext} XP to next level`}>
        <div className="level-top">
          <b>Lv {lvl.level}</b> <span>{lvl.title}</span>
          <span className="muted">{xp} XP</span>
        </div>
        <div className="xp-bar">
          <i style={{ width: `${lvl.progress * 100}%` }} />
        </div>
      </div>

      <div className="hud-stats">
        <span title="Places discovered">🗺️ {count}</span>
        <span title="Streak" className={streak >= 2 ? 'hot' : ''}>
          🔥 {streak}
        </span>
        <button className="ghost" onClick={onLocate} disabled={locating}>
          {locating ? 'Locating…' : '📍 My weather'}
        </button>
      </div>
    </header>
  );
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className="toast" onClick={() => dismiss(t.id)}>
          <span className="toast-emoji">{t.emoji}</span>
          <span>
            <b>{t.title}</b>
            {t.body && <small>{t.body}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}
