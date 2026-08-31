export type Count = { balls: number; strikes: number };
export type CountOutcome = 'ball' | 'strike' | 'foul';

export function advanceCount(count: Count, outcome: CountOutcome): Count {
  if (outcome === 'ball') return { balls: count.balls + 1, strikes: count.strikes };
  if (outcome === 'foul') return { balls: count.balls, strikes: Math.min(2, count.strikes + 1) };
  return { balls: count.balls, strikes: count.strikes + 1 };
}

export function displayCount(count: Count): Count {
  return {
    balls: Math.min(3, count.balls),
    strikes: Math.min(2, count.strikes),
  };
}
