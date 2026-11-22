/**
 * Settings specific to this device (e.g. the Discogs token), in localStorage.
 *
 * Deliberately kept apart from the library: they are never included in the
 * JSON export, and the token only ever leaves the browser to go to Discogs.
 * Storage can be injected for tests.
 */

const KEYS = Object.freeze({
  discogsToken: 'panoptes.discogsToken',
});

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage disabled by the browser
  }
}

export function createSettings(storage = defaultStorage()) {
  function read(key) {
    try {
      return storage?.getItem(key) ?? '';
    } catch {
      return '';
    }
  }

  function write(key, value) {
    if (!storage) throw new Error('Local storage is disabled in this browser.');
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  }

  return {
    getDiscogsToken: () => read(KEYS.discogsToken),
    /** Saves the token (whitespace trimmed); an empty value deletes it. */
    setDiscogsToken: (token) => write(KEYS.discogsToken, String(token ?? '').trim()),
  };
}
