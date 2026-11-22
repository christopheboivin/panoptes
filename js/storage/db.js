/**
 * Accès minimal à IndexedDB (une base, un magasin d'objets).
 *
 * Ce module est le seul à connaître IndexedDB. Pour passer un jour à un
 * stockage distant (synchronisation), il suffira de fournir un autre module
 * exposant les mêmes fonctions : getAll, put, putMany, remove.
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

/** Exécute fn dans une transaction et attend sa fin complète. */
async function withStore(mode, fn) {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  const result = fn(tx.objectStore(STORE));
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée.'));
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
