/**
 * Réglages propres à cet appareil (ex. jeton Discogs), dans le localStorage.
 *
 * Volontairement séparés de la bibliothèque : ils ne sont jamais inclus
 * dans l'export JSON, et le jeton ne quitte le navigateur que vers Discogs.
 * Le stockage est injectable pour les tests.
 */

const KEYS = Object.freeze({
  discogsToken: 'panoptes.discogsToken',
});

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // stockage désactivé par le navigateur
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
    if (!storage) throw new Error('Le stockage local est désactivé dans ce navigateur.');
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  }

  return {
    getDiscogsToken: () => read(KEYS.discogsToken),
    /** Enregistre le jeton (espaces retirés) ; une valeur vide l'efface. */
    setDiscogsToken: (token) => write(KEYS.discogsToken, String(token ?? '').trim()),
  };
}
