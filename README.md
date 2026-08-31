# Strike You Out

A daily, Statcast-informed pitching challenge. The first playable matchup puts Nolan McLean on the mound against Shohei Ohtani.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Current slice

- Four-pitch McLean arsenal from a dated 2026 Baseball Savant snapshot
- Mouse, pen, and touch aiming
- Pitch command error and velocity variation
- Swing, take, whiff, foul, ball-in-play, walk, and strikeout outcomes
- Standardized play-by-play messages and count state
- Responsive, Vercel-ready Next.js application

The Ohtani swing/contact inputs are deliberately marked as demo assumptions. They are isolated from the UI so they can be replaced with derived Statcast profiles.

## Recommended data architecture

Do not call Baseball Savant in response to gameplay. A scheduled daily job should fetch the relevant season data, validate its schema, derive compact pitcher and batter profiles, and publish a versioned daily-matchup JSON snapshot. The app should read that snapshot during its build or through a cached server route.

For a later shuffle feature, the same job can prepare a small pool of eligible pitcher–batter matchups. The browser still receives compact profiles rather than raw pitch-level data, and one Savant outage cannot interrupt a plate appearance.

## Data source

Pitch-level figures in the initial snapshot were transcribed from Nolan McLean's 2026 Baseball Savant pitcher visualization report on August 30, 2026. This is an unofficial prototype and is not affiliated with MLB.
