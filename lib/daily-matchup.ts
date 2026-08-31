import matchupModel from '@/lib/generated/ohtani-2026-vs-rhp.json';

export type Pitch = {
  code: string;
  name: string;
  shortName: string;
  color: string;
  usage: number;
  avgVelocity: number;
  maxVelocity: number;
  whiff: number;
  zoneRate: number;
  movement: 'ride' | 'arm-side-drop' | 'glove-side-drop' | 'glove-side-sweep';
};

export const DAILY_MATCHUP = {
  date: '2026-08-30',
  pitcher: {
    id: 690997,
    name: 'Nolan McLean',
    throws: 'R' as const,
    pitches: [
      { code: 'SI', name: 'Sinker', shortName: 'Sinker', color: 'bg-blue-400', usage: 32.8, avgVelocity: 95.0, maxVelocity: 98.6, whiff: 13.7, zoneRate: 56, movement: 'arm-side-drop' },
      { code: 'FF', name: '4-Seam Fastball', shortName: '4-Seam', color: 'bg-red-400', usage: 20.4, avgVelocity: 96.1, maxVelocity: 98.7, whiff: 27.9, zoneRate: 54, movement: 'ride' },
      { code: 'CU', name: 'Curveball', shortName: 'Curve', color: 'bg-amber-300', usage: 14.8, avgVelocity: 81.9, maxVelocity: 84.7, whiff: 40.4, zoneRate: 31, movement: 'glove-side-drop' },
      { code: 'ST', name: 'Sweeper', shortName: 'Sweeper', color: 'bg-violet-400', usage: 13.2, avgVelocity: 84.9, maxVelocity: 89.4, whiff: 27.4, zoneRate: 40, movement: 'glove-side-sweep' },
    ] satisfies Pitch[],
  },
  batter: {
    id: 660271,
    name: 'Shohei Ohtani',
    bats: 'L' as const,
  },
  source: 'https://baseballsavant.mlb.com/player-scroll?player_id=690997',
} as const;

export const MATCHUP_MODEL = matchupModel;
