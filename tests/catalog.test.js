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

test('a barcode search joins the results of every source, in their order', async () => {
  const first = fakeProvider('MusicBrainz', { results: [{ title: 'A' }] });
  const second = fakeProvider('Discogs', { results: [{ title: 'B' }, { title: 'C' }] });
  const result = await createCatalog([first, second]).searchByBarcode('123');
  assert.equal(result.providerName, 'MusicBrainz and Discogs');
  assert.deepEqual(result.candidates.map((c) => c.title), ['A', 'B', 'C']);
  assert.deepEqual(second.calls, ['123']);
});

test('a text search asks every source, and names only those that found something', async () => {
  const first = fakeProvider('MusicBrainz');
  const second = fakeProvider('Discogs', { results: [{ title: 'B' }] });
  const result = await createCatalog([first, second]).searchByText({ catno: 'PGLP21' });
  assert.equal(result.providerName, 'Discogs');
  assert.deepEqual(first.calls, [{ catno: 'PGLP21' }]);
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
  assert.deepEqual(result.failed, ['MusicBrainz']);
});

test('throws the first error if no source finds anything', async () => {
  const first = fakeProvider('MusicBrainz', { error: new Error('MusicBrainz unavailable') });
  const second = fakeProvider('Discogs');
  await assert.rejects(createCatalog([first, second]).searchByBarcode('123'), /MusicBrainz unavailable/);
});

test('the editions of an album are asked of the source that found it', async () => {
  const asked = [];
  const withEditions = (id) => ({
    ...fakeProvider(id),
    id,
    async* listEditions(album) { asked.push([id, album.source.groupId]); yield [{ title: 'E1' }]; },
  });
  const catalog = createCatalog([withEditions('musicbrainz'), withEditions('discogs')]);
  const album = { title: 'A', source: { provider: 'discogs', id: '1', groupId: '7' } };
  assert.equal(catalog.canListEditions(album), true);
  assert.equal(catalog.canListEditions({ source: { provider: 'discogs', id: '1', groupId: '' } }), false);
  assert.equal(catalog.canListEditions({ source: { provider: 'unknown', groupId: '7' } }), false);
  assert.equal(catalog.sourceName(album), 'discogs');
  const pages = [];
  for await (const page of catalog.listEditions(album)) pages.push(page);
  assert.deepEqual(asked, [['discogs', '7']]);
  assert.equal(pages.length, 1);
});
