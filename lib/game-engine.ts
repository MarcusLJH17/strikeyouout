import { DAILY_MATCHUP, type Pitch } from '@/lib/daily-matchup';

type Count = { balls: number; strikes: number };
type Point = { x: number; y: number };

export type PitchResult = { actual: Point; count: Count; inZone: boolean; message: string; missInches: number; terminal: boolean };

function normalRandom() {
  const u = Math.max(Number.EPSILON, Math.random());
  const v = Math.max(Number.EPSILON, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (value: number) => Math.max(-8, Math.min(108, value));

export function resolvePitch({ pitch, target, count }: { pitch: Pitch; target: Point; count: Count }): PitchResult {
  const spread = 4.2 + (1 - pitch.command) * 16;
  const actual = { x: clamp(target.x + normalRandom() * spread), y: clamp(target.y + normalRandom() * spread) };
  const missInches = Math.hypot(actual.x - target.x, actual.y - target.y) * 0.32;
  const inZone = actual.x >= 17 && actual.x <= 83 && actual.y >= 8 && actual.y <= 86;
  const velocity = Math.max(pitch.avgVelocity - 3.5, Math.min(pitch.maxVelocity, pitch.avgVelocity + normalRandom() * 1.35));
  const discipline = DAILY_MATCHUP.batter.discipline;
  const swings = Math.random() < (inZone ? discipline.zoneSwing : discipline.chase);
  const pitchLabel = `${Math.round(velocity)} mph ${pitch.name.toLowerCase()}`;

  if (!swings) {
    if (inZone) {
      const strikes = count.strikes + 1;
      return finish(`${pitchLabel}, called strike${strikes === 3 ? ' three' : ` ${strikes}`}`, { balls: count.balls, strikes }, actual, inZone, missInches, strikes === 3);
    }
    const balls = count.balls + 1;
    return finish(`${pitchLabel}, ball ${balls}${balls === 4 ? ' — Ohtani walks' : ''}`, { balls, strikes: count.strikes }, actual, inZone, missInches, balls === 4);
  }

  const baseContact = inZone ? discipline.zoneContact : discipline.chaseContact;
  const contactProbability = Math.max(0.32, Math.min(0.94, baseContact - (pitch.whiff / 100 - 0.25) * 0.65));
  if (Math.random() > contactProbability) {
    const strikes = count.strikes + 1;
    return finish(`${pitchLabel}, swing and miss${strikes === 3 ? ' — strike three' : ` — strike ${strikes}`}`, { balls: count.balls, strikes }, actual, inZone, missInches, strikes === 3);
  }
  if (Math.random() < 0.42) {
    const strikes = Math.min(2, count.strikes + 1);
    return finish(`${pitchLabel}, fouled away${count.strikes === 2 ? ' — still 2 strikes' : ''}`, { balls: count.balls, strikes }, actual, inZone, missInches, false);
  }
  const quality = Math.random();
  const outcome = quality < 0.56 ? 'put in play — fielded for an out' : quality < 0.82 ? 'lined into the outfield for a hit' : 'driven deep — extra bases';
  return finish(`${pitchLabel}, ${outcome}`, count, actual, inZone, missInches, true);
}

function finish(message: string, count: Count, actual: Point, inZone: boolean, missInches: number, terminal: boolean): PitchResult {
  return { message: `${message.charAt(0).toUpperCase()}${message.slice(1)}`, count, actual, inZone, missInches, terminal };
}
