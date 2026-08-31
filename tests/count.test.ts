import assert from 'node:assert/strict';
import test from 'node:test';

import { advanceCount, displayCount, type Count } from '../lib/count.ts';

const LIVE_COUNTS: Count[] = Array.from({ length: 4 }, (_, balls) =>
  Array.from({ length: 3 }, (_, strikes) => ({ balls, strikes })),
).flat();

test('a ball changes only the ball total', () => {
  for (const count of LIVE_COUNTS) {
    assert.deepEqual(advanceCount(count, 'ball'), { balls: count.balls + 1, strikes: count.strikes });
  }
});

test('a called or swinging strike changes only the strike total', () => {
  for (const count of LIVE_COUNTS) {
    assert.deepEqual(advanceCount(count, 'strike'), { balls: count.balls, strikes: count.strikes + 1 });
  }
});

test('a foul preserves balls and cannot advance beyond two strikes', () => {
  for (const count of LIVE_COUNTS) {
    assert.deepEqual(advanceCount(count, 'foul'), {
      balls: count.balls,
      strikes: Math.min(2, count.strikes + 1),
    });
  }
});

test('the scoreboard never displays four balls or three strikes', () => {
  assert.deepEqual(displayCount({ balls: 4, strikes: 2 }), { balls: 3, strikes: 2 });
  assert.deepEqual(displayCount({ balls: 2, strikes: 3 }), { balls: 2, strikes: 2 });
});
