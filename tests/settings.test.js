import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettings } from '../js/storage/settings.js';

function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('enregistre, relit et efface le jeton Discogs', () => {
  const storage = memoryStorage();
  const settings = createSettings(storage);
  assert.equal(settings.getDiscogsToken(), '');
  settings.setDiscogsToken('  abc123  ');
  assert.equal(settings.getDiscogsToken(), 'abc123');
  settings.setDiscogsToken('');
  assert.equal(settings.getDiscogsToken(), '');
  assert.equal(storage.data.size, 0);
});

test('sans stockage disponible, la lecture renvoie vide et l\'écriture lève une erreur', () => {
  const settings = createSettings(null);
  assert.equal(settings.getDiscogsToken(), '');
  assert.throws(() => settings.setDiscogsToken('abc'), /désactivé/);
});
