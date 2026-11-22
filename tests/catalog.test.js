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

test('stops at the first source that finds a result', async () => {
  const first = fakeProvider('MusicBrainz', { results: [{ title: 'A' }] });
  const second = fakeProvider('Discogs', { results: [{ title: 'B' }] });
  const result = await createCatalog([first, second]).searchByBarcode('123');
  assert.equal(result.providerName, 'MusicBrainz');
  assert.equal(result.candidates[0].title, 'A');
  assert.equal(second.calls.length, 0);
});

test('moves on to the next source when the first finds nothing', async () => {
  const first = fakeProvider('MusicBrainz');
  const second = fakeProvider('Discogs', { results: [{ title: 'B' }] });
  const result = await createCatalog([first, second]).searchByText({ catno: 'PGLP21' });
  assert.equal(result.providerName, 'Discogs');
  assert.deepEqual(second.calls, [{ catno: 'PGLP21' }]);
});

test('reports sources that are not configured', async () => {
  const first = fakeProvider('MusicBrainz');
  const second = fakeProvider('Discogs', { configured: false });
  const result = await createCatalog([first, second]).searchByBarcode('123');
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.skipped, ['Discogs']);
  assert.equal(second.calls.length, 0);
});

test('an error does not stop the next source from answering', async () => {
  const first = fakeProvider('MusicBrainz', { error: new Error('503') });
  const second = fakeProvider('Discogs', { results: [{ title: 'B' }] });
  const result = await createCatalog([first, second]).searchByBarcode('123');
  assert.equal(result.providerName, 'Discogs');
  assert.equal(result.errors.length, 1);
});

test('throws the first error if no source finds anything', async () => {
  const first = fakeProvider('MusicBrainz', { error: new Error('MusicBrainz unavailable') });
  const second = fakeProvider('Discogs');
  await assert.rejects(createCatalog([first, second]).searchByBarcode('123'), /MusicBrainz unavailable/);
});
