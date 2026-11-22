import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLibrary, parseExport, STATUS } from '../js/storage/library.js';

/** In-memory storage following the contract of js/storage/db.js. */
function memoryStorage() {
  const map = new Map();
  return {
    getAll: async () => [...map.values()],
    put: async (r) => { map.set(r.id, r); },
    putMany: async (rs) => { rs.forEach((r) => map.set(r.id, r)); },
    remove: async (id) => { map.delete(id); },
  };
}

test('an export can be re-imported unchanged', async () => {
  const source = createLibrary(memoryStorage());
  await source.add({ title: 'Blue Train', artist: 'John Coltrane' }, STATUS.OWNED);
  await source.add({ title: 'Mingus Ah Um', artist: 'Charles Mingus' }, STATUS.WANTED);
  const exported = JSON.parse(JSON.stringify(await source.exportData()));

  const target = createLibrary(memoryStorage());
  const result = await target.importData(exported);
  assert.deepEqual(result, { imported: 2, rejected: 0 });
  assert.deepEqual(
    (await target.list()).map((r) => r.title).sort(),
    ['Blue Train', 'Mingus Ah Um'],
  );
});

test('the Collection accepts several copies; the Wishlist stores albums', async () => {
  const lib = createLibrary(memoryStorage());
  const edition = {
    title: 'Kind of Blue', artist: 'Miles Davis', catno: 'CL 1355', country: 'US',
    source: { provider: 'musicbrainz', id: 'r1', groupId: 'g1' },
  };
  const first = await lib.add(edition, STATUS.OWNED);
  const second = await lib.add(edition, STATUS.OWNED);
  assert.notEqual(first.id, second.id);
  assert.equal(second.catno, 'CL 1355');

  const album = await lib.add(edition, STATUS.WANTED);
  assert.equal(album.catno, '');
  assert.equal(album.country, '');
  assert.deepEqual(album.source, { provider: 'musicbrainz', id: '', groupId: 'g1' });
  assert.equal((await lib.list()).length, 3);
});

test('import merges by identifier without duplicates', async () => {
  const lib = createLibrary(memoryStorage());
  await lib.add({ title: 'Blue Train' }, STATUS.OWNED);
  const exported = await lib.exportData();
  await lib.importData(exported);
  assert.equal((await lib.list()).length, 1);
});

test('setStatus moves a record from the wishlist to the collection', async () => {
  const lib = createLibrary(memoryStorage());
  const record = await lib.add({ title: 'Blue Train' }, STATUS.WANTED);
  await lib.setStatus(record, STATUS.OWNED);
  assert.equal((await lib.list())[0].status, STATUS.OWNED);
});

test('parseExport rejects a foreign file and skips invalid records', () => {
  assert.throws(() => parseExport({ records: [] }), /Panoptes export/);
  assert.throws(() => parseExport({ app: 'panoptes', schemaVersion: 99, records: [] }), /newer version/);
  const { records, rejected } = parseExport({
    app: 'panoptes',
    schemaVersion: 1,
    records: [{ id: 'a', status: 'owned', title: 'OK' }, { id: 'b', status: 'owned' }],
  });
  assert.equal(records.length, 1);
  assert.equal(rejected, 1);
});
