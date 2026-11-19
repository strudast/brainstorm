# ⚡ Brainstorm

**Guess the weather anywhere on Earth.** A gamified take on weather exploration: the map shows a handful of "TV forecast" cities as clues, you click anywhere else in the world, guess the temperature and the sky, then reveal the real conditions and score points. Every place you discover becomes part of *your world* — your own picture of the planet's weather, ranked hottest to coldest.

> Work in progress — this is the first playable version.

## How it plays

- **Forecast cities** — 20 cities spread across the globe show live conditions. They're your clues (and the "weather presenter" overview).
- **Discover** — click anywhere on the map or search a place. Before you see anything, guess:
  - the **temperature** (slider, −40 … 50 °C)
  - the **sky** (clear, cloudy, fog, rain, snow, storm)
- **Score** — up to 60 pts for temperature (−6 per degree off) + 40 for the right sky.
- **Streaks** — guesses scoring 60+ build a streak; each step adds +25 % (max ×2).
- **Levels** — XP levels you up from *Light Breeze* to *Brainstorm*.
- **Daily quests** — 3 per day, the same for everyone on a given date (e.g. *find somewhere below freezing*, *find two places 30 °C apart*).
- **Badges** — permanent achievements (*Fire & Ice*, *Full Deck*, *Night Owl*, …).
- **My weather** — one click shows the weather where you are (browser geolocation).
- **Your world** — every discovery, sorted hottest → coldest with a temperature bar.

Progress is saved in `localStorage`.

## 1. Installation & setup

**Prerequisites:** Node.js 20.19+ (or 22.12+) and npm.

```bash
git clone https://github.com/strudast/brainstorm.git
cd brainstorm
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build` (type-check + production build), `npm run preview`, `npm run lint`.

**Environment variables:** none. Open-Meteo's free API needs no key.

## 2. Implementation choices

| | |
|---|---|
| **React 19 + TypeScript + Vite** | Fast dev loop, strict types for API data and game rules. |
| **Leaflet + react-leaflet** | Free, no API key, lightweight. Standard OpenStreetMap tiles, darkened with a CSS filter to fit the theme. |
| **Zustand** (+ `persist`) | Tiny global store for game state, persisted to localStorage with no boilerplate. |
| **Plain CSS** | No UI kit — one stylesheet with CSS variables keeps the look custom and the bundle small. |

**Being mindful of the API limits**

- The 20 overview cities load in **one** multi-location forecast request.
- Forecasts are **cached for 15 minutes** per ~11 km cell (coordinates rounded to 0.1°), in memory and in localStorage, so reloads and revisits are free.
- Identical in-flight requests are **de-duplicated**.
- A new place's weather is fetched **only when you press Reveal**, not when you click around.
- Place search is **debounced** (350 ms), needs 2+ characters, cancels stale requests and caches results.

**Code layout**

```
src/
  api/openMeteo.ts      forecast + geocoding client, caching
  game/rules.ts         scoring, levels, quests, achievements (pure functions)
  game/store.ts         persisted game state + toasts
  lib/                  weather-code mapping, places, helpers
  components/           map, search, place panel (guess → reveal), sidebar, HUD
```

## 3. Incomplete requirements

- Map clicks are named by coordinates (plus time zone): Open-Meteo has no reverse geocoding.
- No automated tests yet.

## 4. Next steps

- Unit tests for `game/rules.ts` (scoring, quest seeding, achievements) and the API cache.
- "Compare" mode: pick two discoveries and see their 7-day forecasts side by side.
- Weather layers on the map (temperature or precipitation overlay) for a true TV-forecast feel.
- Accessibility pass (keyboard play on the map, reduced-motion support).
- Shareable daily result ("Brainstorm #42 — 🎯🎯🔥 512 XP").

## 5. Additional notes

- Weather data: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Map data and tiles © OpenStreetMap contributors.
- AI tools were used to help build this project.
