import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog } from '../js/providers/catalog.js';

function fakeProvider(name, { configured = true, results = [], error = null } = {}) {
  const calls = [];
  const search = async (query) => {
    calls.push(query);
    if (error) throw error;
    return results;
  };
  return { name, calls, isConfigured: () => configured, searchByBarcode: search, searchByText: search };
}

test('s\'arrête à la première source qui trouve un résultat', async () => {
  const first = fakeProvider('MusicBrainz', { results: [{ title: 'A' }] });
  const second = fakeProvider('Discogs', { results: [{ title: 'B' }] });
  const result = await createCatalog([first, second]).searchByBarcode('123');
  assert.equal(result.providerName, 'MusicBrainz');
  assert.equal(result.candidates[0].title, 'A');
  assert.equal(second.calls.length, 0);
});

test('passe à la source suivante quand la première ne trouve rien', async () => {
  const first = fakeProvider('MusicBrainz');
  const second = fakeProvider('Discogs', { results: [{ title: 'B' }] });
  const result = await createCatalog([first, second]).searchByText({ catno: 'PGLP21' });
  assert.equal(result.providerName, 'Discogs');
  assert.deepEqual(second.calls, [{ catno: 'PGLP21' }]);
});

test('signale les sources non configurées', async () => {
  const first = fakeProvider('MusicBrainz');
  const second = fakeProvider('Discogs', { configured: false });
  const result = await createCatalog([first, second]).searchByBarcode('123');
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.skipped, ['Discogs']);
  assert.equal(second.calls.length, 0);
});

test('une erreur n\'empêche pas la source suivante de répondre', async () => {
  const first = fakeProvider('MusicBrainz', { error: new Error('503') });
  const second = fakeProvider('Discogs', { results: [{ title: 'B' }] });
  const result = await createCatalog([first, second]).searchByBarcode('123');
  assert.equal(result.providerName, 'Discogs');
  assert.equal(result.errors.length, 1);
});

test('lève la première erreur si aucune source ne trouve rien', async () => {
  const first = fakeProvider('MusicBrainz', { error: new Error('MusicBrainz indisponible') });
  const second = fakeProvider('Discogs');
  await assert.rejects(createCatalog([first, second]).searchByBarcode('123'), /MusicBrainz indisponible/);
});
