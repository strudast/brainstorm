import { useCallback, useEffect, useState } from 'react';
import { getCachedWeather, getTemperatureGrid, getWeather, getWeatherMany } from './api/openMeteo';
import type { GeoResult, TempGrid, Weather } from './api/openMeteo';
import { Compare } from './components/Compare';
import { TempLegend } from './components/TempLayer';
import { Hud, Toasts } from './components/Hud';
import { PlacePanel } from './components/PlacePanel';
import { SearchBar } from './components/SearchBar';
import { Badges, Collection, Quests } from './components/Sidebar';
import { WorldMap } from './components/WorldMap';
import type { Place } from './game/rules';
import { useGame, useToasts } from './game/store';
import { OVERVIEW_CITIES, placeFromGeo, placeFromPoint } from './lib/places';

type Tab = 'explore' | 'compare' | 'world' | 'badges';

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
  const [tempGrid, setTempGrid] = useState<TempGrid | null>(null);
  const [showTemps, setShowTemps] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  const compareCount = useGame((s) => s.compare.length);

  // New quests at midnight, even if the tab stays open.
  useEffect(() => {
    ensureDailyQuests();
    const onVisible = () => document.visibilityState === 'visible' && ensureDailyQuests();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(ensureDailyQuests, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [ensureDailyQuests]);

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

  // Lazy: the 180-point grid is only requested when the player turns the layer on.
  const toggleTemps = () => {
    if (showTemps) return setShowTemps(false);
    if (tempGrid) return setShowTemps(true);
    setGridLoading(true);
    getTemperatureGrid()
      .then((g) => {
        setTempGrid(g);
        setShowTemps(true);
      })
      .catch((e: Error) => pushToast({ emoji: '🌡️', title: 'Temperature layer unavailable', body: e.message }))
      .finally(() => setGridLoading(false));
  };

  const randomSpot = () => {
    const lat = -55 + Math.random() * 125;
    const lon = -180 + Math.random() * 360;
    select(placeFromPoint(lat, lon));
  };

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
            tempGrid={showTemps ? tempGrid : null}
            onPick={(lat, lon) => select(placeFromPoint(lat, lon))}
            onSelect={select}
          />
          <div className="map-controls">
            <button className={`map-btn ${showTemps ? 'on' : ''}`} onClick={toggleTemps} disabled={gridLoading} aria-pressed={showTemps}>
              {gridLoading ? 'Loading…' : '🌡️ Temperature layer'}
            </button>
            <button className="map-btn" onClick={randomSpot}>
              🎲 Random spot
            </button>
            {showTemps && <TempLegend />}
          </div>
          {overviewError && <div className="map-banner">Couldn't load the forecast cities: {overviewError}</div>}
        </div>

        <aside className="panel">
          <SearchBar onChoose={(g: GeoResult) => select(placeFromGeo(g))} />
          <nav className="tabs">
            {(
              [
                ['explore', '🔭 Explore'],
                ['compare', `⚖️ Compare${compareCount ? ` · ${compareCount}` : ''}`],
                ['world', '🗺️ World'],
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
                  <PlacePanel key={selected.id} place={selected} onClose={() => setSelected(null)} onCompare={() => setTab('compare')} />
                ) : (
                  <section className="card intro">
                    <h2>How to play</h2>
                    <ol>
                      <li>The small weather chips are forecast cities — your clues.</li>
                      <li>Click anywhere on the map (or search a place).</li>
                      <li>Guess the temperature and the sky, then reveal.</li>
                      <li>Close guesses score big. Keep a streak for multipliers.</li>
                      <li>Just exploring? Every place has a “Just show me” option.</li>
                    </ol>
                  </section>
                )}
                <Quests />
              </>
            )}
            {tab === 'compare' && <Compare onSelect={select} />}
            {tab === 'world' && <Collection onSelect={select} />}
            {tab === 'badges' && <Badges />}
          </div>
        </aside>
      </main>
      <Toasts />
    </div>
  );
}
