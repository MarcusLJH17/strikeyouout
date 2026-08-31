import { MATCHUP_MODEL, type Pitch } from '@/lib/daily-matchup';

type Count = { balls: number; strikes: number };
type Point = { x: number; y: number };
type Outcome = 'called_strike' | 'ball' | 'whiff' | 'foul' | 'in_play_out' | 'hit' | 'extra_base';
type RateKey = 'swing' | 'contact' | 'foulOnContact' | 'hitOnBip' | 'extraBaseOnHit';
type RateProfile = { sample: number; swing: number; contact: number; foulOnContact: number; hitOnBip: number; extraBaseOnHit: number };
type ModelProfile = {
  overall: RateProfile;
  zone: RateProfile;
  chase: RateProfile;
  byCount: Record<string, RateProfile>;
  byPitch: Record<string, RateProfile>;
  hotZones: Record<string, RateProfile>;
  sequences: Record<string, RateProfile>;
  commandByPitch: Record<string, { sample: number; medianMissInches: number }>;
};

const model = MATCHUP_MODEL as unknown as ModelProfile;
const FASTBALLS = new Set(['FF', 'SI', 'FC']);
const X_INCHES_PER_PERCENT = 17 / 66;
const Y_INCHES_PER_PERCENT = 40 / 78;
const BASEBALL_RADIUS_INCHES = 1.45;
const ZONE = { left: 17, right: 83, top: 8, bottom: 86 } as const;
const RAYLEIGH_MEDIAN_FACTOR = Math.sqrt(2 * Math.log(2));

export type PitchHistoryEntry = {
  pitchCode: string;
  actual: Point;
  velocity: number;
  outcome: Outcome;
};

export type PitchResult = PitchHistoryEntry & {
  count: Count;
  factors: string[];
  inZone: boolean;
  message: string;
  missInches: number;
  terminal: boolean;
};

function normalRandom() {
  const u = Math.max(Number.EPSILON, Math.random());
  const v = Math.max(Number.EPSILON, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clampLocation = (value: number) => Math.max(-8, Math.min(108, value));
const clampProbability = (value: number, minimum = 0.02, maximum = 0.98) => Math.max(minimum, Math.min(maximum, value));

function ratio(profile: RateProfile | undefined, reference: RateProfile, key: RateKey, exponent: number) {
  if (!profile || !reference[key]) return 1;
  const raw = Math.max(0.65, Math.min(1.45, profile[key] / reference[key]));
  return raw ** exponent;
}

function hotZoneKey(point: Point) {
  const horizontal = point.x < 39 ? 'left' : point.x > 61 ? 'right' : 'middle';
  const vertical = point.y < 34 ? 'upper' : point.y > 60 ? 'lower' : 'middle';
  return `${vertical}_${horizontal}`;
}

function touchesStrikeZone(point: Point) {
  const radiusX = BASEBALL_RADIUS_INCHES / X_INCHES_PER_PERCENT;
  const radiusY = BASEBALL_RADIUS_INCHES / Y_INCHES_PER_PERCENT;
  return point.x + radiusX >= ZONE.left
    && point.x - radiusX <= ZONE.right
    && point.y + radiusY >= ZONE.top
    && point.y - radiusY <= ZONE.bottom;
}

function advanceCount(count: Count, outcome: 'ball' | 'strike' | 'foul'): Count {
  if (outcome === 'ball') return { balls: count.balls + 1, strikes: count.strikes };
  if (outcome === 'foul') return { balls: count.balls, strikes: Math.min(2, count.strikes + 1) };
  return { balls: count.balls, strikes: count.strikes + 1 };
}

function sequenceContext(history: PitchHistoryEntry[], pitch: Pitch, actual: Point, velocity: number) {
  const previous = history.at(-1);
  if (!previous) return { profiles: [] as RateProfile[], labels: [] as string[] };

  const profiles: RateProfile[] = [];
  const labels: string[] = [];
  const add = (key: string, label: string) => {
    const sequenceProfile = model.sequences[key];
    if (sequenceProfile) {
      profiles.push(sequenceProfile);
      labels.push(label);
    }
  };

  add(previous.pitchCode === pitch.code ? 'repeat' : 'change', previous.pitchCode === pitch.code ? 'repeated pitch' : 'pitch change');
  if (previous.actual.y < 34 && actual.y > 60) add('highToLow', 'high-to-low setup');
  if (Math.abs(previous.velocity - velocity) >= 7) add('velocityContrast', '7+ mph separation');
  if (FASTBALLS.has(previous.pitchCode) && !FASTBALLS.has(pitch.code)) add('fastballToSoft', 'fastball-to-soft');
  return { profiles, labels };
}

function commandLocation(pitch: Pitch, target: Point) {
  const command = model.commandByPitch[pitch.code] ?? model.commandByPitch.ALL;
  const axisSigmaInches = command.medianMissInches / RAYLEIGH_MEDIAN_FACTOR;
  const xMissInches = normalRandom() * axisSigmaInches;
  const yMissInches = normalRandom() * axisSigmaInches;
  return {
    actual: {
      x: clampLocation(target.x + xMissInches / X_INCHES_PER_PERCENT),
      y: clampLocation(target.y + yMissInches / Y_INCHES_PER_PERCENT),
    },
    missInches: Math.hypot(xMissInches, yMissInches),
    command,
  };
}

export function resolvePitch({ pitch, target, count, history }: { pitch: Pitch; target: Point; count: Count; history: PitchHistoryEntry[] }): PitchResult {
  const { actual, missInches, command } = commandLocation(pitch, target);
  // ABS rules a strike when any part of the baseball touches any part of the zone.
  const inZone = touchesStrikeZone(actual);
  const velocity = Math.max(pitch.avgVelocity - 3.5, Math.min(pitch.maxVelocity, pitch.avgVelocity + normalRandom() * 1.35));
  const locationProfile = inZone ? model.zone : model.chase;
  const pitchProfile = model.byPitch[pitch.code] ?? model.overall;
  const countProfile = model.byCount[`${count.balls}-${count.strikes}`] ?? model.overall;
  const zoneKey = inZone ? hotZoneKey(actual) : null;
  const hotProfile = zoneKey ? model.hotZones[zoneKey] : undefined;
  const sequence = sequenceContext(history, pitch, actual, velocity);
  const pitchLabel = `${Math.round(velocity)} mph ${pitch.name.toLowerCase()}`;
  const factors = [
    `${count.balls}-${count.strikes} count`,
    inZone && zoneKey ? `${zoneKey.replace('_', ' ')} hot zone` : 'chase location',
    ...sequence.labels,
    `command: ${command.medianMissInches.toFixed(1)} in median (n=${command.sample})`,
  ];

  let swingProbability = locationProfile.swing;
  swingProbability *= ratio(countProfile, model.overall, 'swing', 0.55);
  swingProbability *= ratio(pitchProfile, model.overall, 'swing', 0.4);
  swingProbability *= ratio(hotProfile, model.zone, 'swing', 0.65);
  for (const profile of sequence.profiles) swingProbability *= ratio(profile, model.overall, 'swing', 0.4);
  swingProbability = clampProbability(swingProbability, 0.04, 0.96);

  if (Math.random() >= swingProbability) {
    if (inZone) {
      const nextCount = advanceCount(count, 'strike');
      return finish({ pitch, velocity, actual, outcome: 'called_strike', message: `${pitchLabel}, called strike${nextCount.strikes === 3 ? ' three' : ` ${nextCount.strikes}`}`, count: nextCount, inZone, missInches, terminal: nextCount.strikes === 3, factors });
    }
    const nextCount = advanceCount(count, 'ball');
    return finish({ pitch, velocity, actual, outcome: 'ball', message: `${pitchLabel}, ball ${nextCount.balls}${nextCount.balls === 4 ? ' — Ohtani walks' : ''}`, count: nextCount, inZone, missInches, terminal: nextCount.balls === 4, factors });
  }

  let contactProbability = locationProfile.contact;
  contactProbability *= ratio(countProfile, model.overall, 'contact', 0.45);
  contactProbability *= ratio(pitchProfile, model.overall, 'contact', 0.5);
  contactProbability *= ratio(hotProfile, model.zone, 'contact', 0.65);
  for (const profile of sequence.profiles) contactProbability *= ratio(profile, model.overall, 'contact', 0.45);
  const pitcherWhiffContact = (1 - pitch.whiff / 100) / 0.75;
  contactProbability *= Math.max(0.78, Math.min(1.16, pitcherWhiffContact ** 0.45));
  contactProbability = clampProbability(contactProbability, 0.22, 0.95);

  if (Math.random() >= contactProbability) {
    const nextCount = advanceCount(count, 'strike');
    return finish({ pitch, velocity, actual, outcome: 'whiff', message: `${pitchLabel}, swing and miss${nextCount.strikes === 3 ? ' — strike three' : ` — strike ${nextCount.strikes}`}`, count: nextCount, inZone, missInches, terminal: nextCount.strikes === 3, factors });
  }

  let foulProbability = locationProfile.foulOnContact;
  foulProbability *= ratio(pitchProfile, model.overall, 'foulOnContact', 0.45);
  foulProbability *= ratio(hotProfile, model.zone, 'foulOnContact', 0.4);
  for (const profile of sequence.profiles) foulProbability *= ratio(profile, model.overall, 'foulOnContact', 0.25);
  foulProbability = clampProbability(foulProbability, 0.25, 0.72);

  if (Math.random() < foulProbability) {
    const nextCount = advanceCount(count, 'foul');
    const foulDescription = inZone ? 'fouled away' : 'chased and fouled away';
    const countDescription = count.strikes === 2 ? ' — count holds at 2 strikes' : ` — strike ${nextCount.strikes}`;
    return finish({ pitch, velocity, actual, outcome: 'foul', message: `${pitchLabel}, ${foulDescription}${countDescription}`, count: nextCount, inZone, missInches, terminal: false, factors });
  }

  let hitProbability = locationProfile.hitOnBip;
  hitProbability *= ratio(pitchProfile, model.overall, 'hitOnBip', 0.5);
  hitProbability *= ratio(countProfile, model.overall, 'hitOnBip', 0.2);
  hitProbability *= ratio(hotProfile, model.zone, 'hitOnBip', 0.7);
  for (const profile of sequence.profiles) hitProbability *= ratio(profile, model.overall, 'hitOnBip', 0.35);
  hitProbability = clampProbability(hitProbability, 0.16, 0.62);

  if (Math.random() >= hitProbability) {
    return finish({ pitch, velocity, actual, outcome: 'in_play_out', message: `${pitchLabel}, put in play — fielded for an out`, count, inZone, missInches, terminal: true, factors });
  }

  let extraBaseProbability = locationProfile.extraBaseOnHit;
  extraBaseProbability *= ratio(pitchProfile, model.overall, 'extraBaseOnHit', 0.45);
  extraBaseProbability *= ratio(hotProfile, model.zone, 'extraBaseOnHit', 0.65);
  for (const profile of sequence.profiles) extraBaseProbability *= ratio(profile, model.overall, 'extraBaseOnHit', 0.3);
  extraBaseProbability = clampProbability(extraBaseProbability, 0.16, 0.7);
  const extraBase = Math.random() < extraBaseProbability;
  return finish({ pitch, velocity, actual, outcome: extraBase ? 'extra_base' : 'hit', message: `${pitchLabel}, ${extraBase ? 'driven deep — extra bases' : 'lined into the outfield for a hit'}`, count, inZone, missInches, terminal: true, factors });
}

function finish({ pitch, velocity, actual, outcome, message, count, inZone, missInches, terminal, factors }: { pitch: Pitch; velocity: number; actual: Point; outcome: Outcome; message: string; count: Count; inZone: boolean; missInches: number; terminal: boolean; factors: string[] }): PitchResult {
  return {
    pitchCode: pitch.code,
    velocity,
    actual,
    outcome,
    message: `${message.charAt(0).toUpperCase()}${message.slice(1)}`,
    count,
    inZone,
    missInches,
    terminal,
    factors,
  };
}
