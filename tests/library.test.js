import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLibrary, parseExport, STATUS } from '../js/storage/library.js';

/** Stockage en mémoire respectant le contrat de js/storage/db.js. */
function memoryStorage() {
  const map = new Map();
  return {
    getAll: async () => [...map.values()],
    put: async (r) => { map.set(r.id, r); },
    putMany: async (rs) => { rs.forEach((r) => map.set(r.id, r)); },
    remove: async (id) => { map.delete(id); },
  };
}

test("un export se réimporte à l'identique", async () => {
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

test("l'import fusionne par identifiant sans doublon", async () => {
  const lib = createLibrary(memoryStorage());
  await lib.add({ title: 'Blue Train' }, STATUS.OWNED);
  const exported = await lib.exportData();
  await lib.importData(exported);
  assert.equal((await lib.list()).length, 1);
});

test("setStatus déplace un disque des envies vers la collection", async () => {
  const lib = createLibrary(memoryStorage());
  const record = await lib.add({ title: 'Blue Train' }, STATUS.WANTED);
  await lib.setStatus(record, STATUS.OWNED);
  assert.equal((await lib.list())[0].status, STATUS.OWNED);
});

test('parseExport rejette un fichier étranger et ignore les disques invalides', () => {
  assert.throws(() => parseExport({ records: [] }), /export Panoptes/);
  assert.throws(() => parseExport({ app: 'panoptes', schemaVersion: 99, records: [] }), /plus récente/);
  const { records, rejected } = parseExport({
    app: 'panoptes',
    schemaVersion: 1,
    records: [{ id: 'a', status: 'owned', title: 'OK' }, { id: 'b', status: 'owned' }],
  });
  assert.equal(records.length, 1);
  assert.equal(rejected, 1);
});
