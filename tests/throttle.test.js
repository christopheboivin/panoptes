import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThrottle } from '../js/providers/throttle.js';

/** Fake clock: time only moves when the test says so; sleeps are recorded, not waited. */
function fakeClock(start = 10_000) {
  const clock = {
    time: start,
    sleeps: [],
    now: () => clock.time,
    sleep: async (ms) => { clock.sleeps.push(ms); },
  };
  return clock;
}

test('the first request does not wait', async () => {
  const clock = fakeClock();
  const throttle = createThrottle(1000, clock);
  await throttle();
  assert.deepEqual(clock.sleeps, []);
});

test('a request soon after the previous one waits for the rest of the delay', async () => {
  const clock = fakeClock();
  const throttle = createThrottle(1000, clock);
  await throttle();
  clock.time += 400;
  await throttle();
  assert.deepEqual(clock.sleeps, [600]);
});

test('a request after the delay has passed does not wait', async () => {
  const clock = fakeClock();
  const throttle = createThrottle(1000, clock);
  await throttle();
  clock.time += 2500;
  await throttle();
  assert.deepEqual(clock.sleeps, []);
});

test('simultaneous requests are queued one delay apart', async () => {
  const clock = fakeClock();
  const throttle = createThrottle(1000, clock);
  await Promise.all([throttle(), throttle(), throttle()]);
  assert.deepEqual(clock.sleeps, [1000, 2000]);
});
