import { useCallback, useEffect, useState } from 'react';
import { getCachedWeather, getWeather, getWeatherMany } from './api/openMeteo';
import type { GeoResult, Weather } from './api/openMeteo';
import { Hud, Toasts } from './components/Hud';
import { PlacePanel } from './components/PlacePanel';
import { SearchBar } from './components/SearchBar';
import { Badges, Collection, Quests } from './components/Sidebar';
import { WorldMap } from './components/WorldMap';
import type { Place } from './game/rules';
import { useGame, useToasts } from './game/store';
import { OVERVIEW_CITIES, placeFromGeo, placeFromPoint } from './lib/places';

type Tab = 'explore' | 'world' | 'badges';

export default function App() {
  const ensureDailyQuests = useGame((s) => s.ensureDailyQuests);
  const discoveries = useGame((s) => s.discoveries);
  const home = useGame((s) => s.home);
  const setHome = useGame((s) => s.setHome);
  const pushToast = useToasts((s) => s.push);

  const [overview, setOverview] = useState<{ place: Place; weather: Weather | null }[]>(
    OVERVIEW_CITIES.map((place) => ({ place, weather: getCachedWeather(place.lat, place.lon) })),
  );
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [homeWeather, setHomeWeather] = useState<Weather | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const [tab, setTab] = useState<Tab>('explore');
  const [locating, setLocating] = useState(false);

  useEffect(() => ensureDailyQuests(), [ensureDailyQuests]);

  // The "TV forecast" overview: all cities in a single request.
  useEffect(() => {
    getWeatherMany(OVERVIEW_CITIES)
      .then((ws) => setOverview(OVERVIEW_CITIES.map((place, i) => ({ place, weather: ws[i] }))))
      .catch((e: Error) => setOverviewError(e.message));
  }, []);

  useEffect(() => {
    if (home) getWeather(home.lat, home.lon).then(setHomeWeather).catch(() => {});
  }, [home]);

  const select = useCallback((p: Place) => {
    setSelected(p);
    setTab('explore');
  }, []);

  const locate = () => {
    if (!navigator.geolocation) {
      pushToast({ emoji: '🛰️', title: 'Location not available', body: 'Your browser does not support geolocation.' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: Place = { id: 'home', name: 'My weather', lat: pos.coords.latitude, lon: pos.coords.longitude };
        setHome(p);
        select(p);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        pushToast({ emoji: '🛰️', title: 'Could not get your location', body: err.message });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  return (
    <div className="app">
      <Hud onLocate={locate} locating={locating} />
      <main className="layout">
        <div className="map-wrap">
          <WorldMap
            overview={overview}
            discoveries={Object.values(discoveries)}
            home={home ? { place: home, weather: homeWeather } : null}
            selected={selected}
            onPick={(lat, lon) => select(placeFromPoint(lat, lon))}
            onSelect={select}
          />
          {overviewError && <div className="map-banner">Couldn't load the forecast cities: {overviewError}</div>}
        </div>

        <aside className="panel">
          <SearchBar onChoose={(g: GeoResult) => select(placeFromGeo(g))} />
          <nav className="tabs">
            {(
              [
                ['explore', '🔭 Explore'],
                ['world', '🗺️ Your world'],
                ['badges', '🏅 Badges'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>

          <div className="panel-body">
            {tab === 'explore' && (
              <>
                {selected ? (
                  <PlacePanel key={selected.id} place={selected} onClose={() => setSelected(null)} />
                ) : (
                  <section className="card intro">
                    <h2>How to play</h2>
                    <ol>
                      <li>The glowing chips are forecast cities — your clues.</li>
                      <li>Click anywhere on the map (or search a place).</li>
                      <li>Guess the temperature and the sky, then reveal.</li>
                      <li>Close guesses score big. Keep a streak for multipliers.</li>
                    </ol>
                  </section>
                )}
                <Quests />
              </>
            )}
            {tab === 'world' && <Collection onSelect={select} />}
            {tab === 'badges' && <Badges />}
          </div>
        </aside>
      </main>
      <Toasts />
    </div>
  );
}
