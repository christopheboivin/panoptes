/**
 * Bibliothèque de disques : règles métier au-dessus du stockage.
 *
 * L'interface utilisateur ne parle qu'à ce module, jamais à db.js.
 * Le stockage est injecté (createLibrary(storage)) pour pouvoir être
 * remplacé ou simulé dans les tests.
 */

import { createRecord, validateRecord, STATUS } from '../models/record.js';

export const EXPORT_APP = 'panoptes';
export const EXPORT_SCHEMA_VERSION = 1;

/** Construit le contenu d'un fichier d'export (objet JSON sérialisable). */
export function buildExport(records, now = new Date()) {
  return {
    app: EXPORT_APP,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    records,
  };
}

/**
 * Lit le contenu d'un fichier d'export et renvoie les disques validés.
 * Les disques invalides sont écartés et comptés, sans bloquer l'import.
 */
export function parseExport(data) {
  if (!data || data.app !== EXPORT_APP || !Array.isArray(data.records)) {
    throw new Error("Ce fichier n'est pas un export Panoptes.");
  }
  if (data.schemaVersion > EXPORT_SCHEMA_VERSION) {
    throw new Error('Cet export provient d\'une version plus récente de Panoptes.');
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

export function createLibrary(storage) {
  return {
    list: () => storage.getAll(),

    async add(candidate, status) {
      const record = createRecord(candidate, status);
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

    /** Fusionne un export : les disques de même identifiant sont remplacés. */
    async importData(data) {
      const { records, rejected } = parseExport(data);
      await storage.putMany(records);
      return { imported: records.length, rejected };
    },
  };
}

export { STATUS };
