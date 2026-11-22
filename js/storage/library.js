/**
 * Record library: business rules on top of storage.
 *
 * The user interface only talks to this module, never to db.js.
 * Storage is injected (createLibrary(storage)) so that it can be
 * replaced, or faked in tests.
 */

import { createRecord, validateRecord, toAlbum, STATUS } from '../models/record.js';

export const EXPORT_APP = 'panoptes';
export const EXPORT_SCHEMA_VERSION = 1;

/** Builds the content of an export file (serialisable JSON object). */
export function buildExport(records, now = new Date()) {
  return {
    app: EXPORT_APP,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    records,
  };
}

/**
 * Reads the content of an export file and returns the validated records.
 * Invalid records are skipped and counted, without blocking the import.
 */
export function parseExport(data) {
  if (!data || data.app !== EXPORT_APP || !Array.isArray(data.records)) {
    throw new Error('This file is not a Panoptes export.');
  }
  if (data.schemaVersion > EXPORT_SCHEMA_VERSION) {
    throw new Error('This export comes from a newer version of Panoptes.');
  }
  const records = [];
  let rejected = 0;
  for (const item of data.records) {
    try {
      records.push(validateRecord(item));
    } catch {
      rejected += 1;
    }
  }
  return { records, rejected };
}

/** Number of records per list: { owned, wanted }. */
export function countByStatus(records) {
  const counts = Object.fromEntries(Object.values(STATUS).map((status) => [status, 0]));
  for (const record of records) counts[record.status] += 1;
  return counts;
}

export function createLibrary(storage) {
  return {
    list: () => storage.getAll(),

    /**
     * Adds a copy to the Collection, or an album to the Wishlist (the
     * edition details of the candidate are then dropped). Duplicates are
     * allowed: see models/match.js to tell the user about them.
     */
    async add(candidate, status) {
      const record = createRecord(status === STATUS.WANTED ? toAlbum(candidate) : candidate, status);
      await storage.put(record);
      return record;
    },

    async setStatus(record, status) {
      const updated = validateRecord({ ...record, status, updatedAt: new Date().toISOString() });
      await storage.put(updated);
      return updated;
    },

    remove: (id) => storage.remove(id),

    async exportData() {
      return buildExport(await storage.getAll());
    },

    /**
     * Merges an export: records with the same identifier are replaced.
     * counts: records imported per list (see countByStatus).
     */
    async importData(data) {
      const { records, rejected } = parseExport(data);
      await storage.putMany(records);
      return { imported: records.length, rejected, counts: countByStatus(records) };
    },
  };
}

export { STATUS };
