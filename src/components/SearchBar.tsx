import { useEffect, useState } from 'react';
import { searchPlaces } from '../api/openMeteo';
import type { GeoResult } from '../api/openMeteo';

export function SearchBar({ onChoose }: { onChoose: (g: GeoResult) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    // Debounce to stay well within the free API limits.
    const t = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setError(null);
          setOpen(true);
        })
        .catch((e: Error) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const choose = (g: GeoResult) => {
    onChoose(g);
    setQ('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="search">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) choose(results[0]);
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Search a city, or click anywhere on the map…"
        aria-label="Search places"
      />
      {open && (results.length > 0 || error) && (
        <ul className="search-results" role="listbox">
          {error && <li className="muted">{error}</li>}
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => choose(r)}>
                <b>{r.name}</b>
                <span className="muted">{[r.admin1, r.country].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !error && q.trim().length >= 2 && results.length === 0 && <div className="search-results muted pad">No matches yet…</div>}
    </div>
  );
}
