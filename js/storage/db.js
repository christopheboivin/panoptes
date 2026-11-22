/**
 * Minimal IndexedDB access (one database, one object store).
 *
 * This is the only module that knows about IndexedDB. To switch to remote
 * storage one day (sync), provide another module exposing the same
 * functions: getAll, put, putMany, remove.
 */

const DB_NAME = 'panoptes';
const DB_VERSION = 1;
const STORE = 'records';

let dbPromise = null;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDb() {
  if (!dbPromise) {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    dbPromise = promisify(request);
  }
  return dbPromise;
}

/** Runs fn in a transaction and waits for it to complete. */
async function withStore(mode, fn) {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  const result = fn(tx.objectStore(STORE));
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted.'));
  });
  return result;
}

export async function getAll() {
  const db = await openDb();
  return promisify(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
}

export function put(record) {
  return withStore('readwrite', (store) => { store.put(record); });
}

export function putMany(records) {
  return withStore('readwrite', (store) => { records.forEach((r) => store.put(r)); });
}

export function remove(id) {
  return withStore('readwrite', (store) => { store.delete(id); });
}
