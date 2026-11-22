/**
 * Request throttling: guarantees a minimum delay between the start of two
 * requests to the same service (MusicBrainz, Discogs).
 *
 * Each call reserves its time slot *before* waiting, so calls started at the
 * same moment are queued one after the other instead of all waiting the same
 * delay and then firing together.
 */

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {number} minDelayMs - minimum delay between the start of two requests
 * @param {object} [options] - replaceable in tests
 * @param {() => number} [options.now] - current time in ms
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @returns {() => Promise<void>} resolves when the next request may start
 */
export function createThrottle(minDelayMs, { now = Date.now, sleep = defaultSleep } = {}) {
  let nextSlot = 0;
  return async function throttle() {
    const current = now();
    const slot = Math.max(current, nextSlot);
    nextSlot = slot + minDelayMs;
    if (slot > current) await sleep(slot - current);
  };
}
