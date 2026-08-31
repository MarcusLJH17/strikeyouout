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
- Pitch command error calibrated to inferred catcher targets, plus velocity variation
- Swing, take, whiff, foul, ball-in-play, walk, and strikeout outcomes
- Batter adjustments for count, pitch type, 3×3 hot zone, and in-at-bat pitch sequence
- Standardized play-by-play messages and count state
- Responsive, Vercel-ready Next.js application

Ohtani's response profile is generated from 1,541 pitches he saw from right-handed pitchers through August 30, 2026. The checked-in generator derives swing, contact, foul, hit, and extra-base rates overall and by zone, count, pitch type, 3×3 location, and common two-pitch sequence patterns. Sparse subgroups are shrunk toward the relevant baseline before gameplay.

Command starts with OpenCommand's pitch-level catcher-target inference. For playable aiming, the simulation uses half the published median miss for McLean and the selected pitch, then caps misses at twice that modeled median. Horizontal and vertical miss retain a centered Gaussian shape. Pitch-to-pitch command differences remain data-derived, while the gameplay scale and tail cap are explicit tuning choices because public Statcast does not include the pitcher's intended target and inferred broadcast targets add measurement noise.

## Recommended data architecture

Do not call Baseball Savant in response to gameplay. A scheduled daily job should fetch the relevant season data, validate its schema, derive compact pitcher and batter profiles, and publish a versioned daily-matchup JSON snapshot. The app should read that snapshot during its build or through a cached server route.

For a later shuffle feature, the same job can prepare a small pool of eligible pitcher–batter matchups. The browser still receives compact profiles rather than raw pitch-level data, and one Savant outage cannot interrupt a plate appearance.

## Data source

Pitch-level batter data comes from Baseball Savant Statcast Search. McLean's arsenal figures were transcribed from his 2026 Baseball Savant pitcher visualization report on August 30, 2026. Command data comes from [OpenCommand](https://huggingface.co/datasets/tomdoyo/open-command), licensed CC BY-NC-SA 4.0. This is an unofficial prototype and is not affiliated with MLB.
