/**
 * Modèle d'un disque de la bibliothèque.
 *
 * Un « record » est un disque possédé (collection) ou souhaité (envies).
 * Toutes les données de la bibliothèque passent par createRecord() et
 * validateRecord(), qui garantissent une forme stable et sérialisable.
 */

export const STATUS = Object.freeze({
  OWNED: 'owned',
  WANTED: 'wanted',
});

const STATUSES = new Set(Object.values(STATUS));

/** Champs texte optionnels d'un disque (toujours des chaînes, éventuellement vides). */
const TEXT_FIELDS = ['title', 'artist', 'year', 'format', 'label', 'catno', 'barcode', 'country', 'notes'];

function newId() {
  return globalThis.crypto.randomUUID();
}

function asText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/**
 * Crée un disque à partir d'un candidat d'identification (voir providers/).
 * @param {object} candidate - données descriptives (titre, artiste, source…)
 * @param {string} status - STATUS.OWNED ou STATUS.WANTED
 */
export function createRecord(candidate, status, now = new Date()) {
  const timestamp = now.toISOString();
  return validateRecord({
    ...candidate,
    id: newId(),
    status,
    addedAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Vérifie et normalise un disque (utilisé à la création et à l'import).
 * Lève une erreur explicite si le disque est inutilisable.
 */
export function validateRecord(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Disque invalide : objet attendu.');
  }
  if (typeof input.id !== 'string' || input.id === '') {
    throw new Error('Disque invalide : identifiant manquant.');
  }
  if (!STATUSES.has(input.status)) {
    throw new Error(`Disque invalide : statut inconnu « ${input.status} ».`);
  }

  const record = { id: input.id, status: input.status };
  for (const field of TEXT_FIELDS) {
    record[field] = asText(input[field]);
  }
  if (!record.title) {
    throw new Error('Disque invalide : titre manquant.');
  }

  record.source = input.source && typeof input.source === 'object'
    ? { provider: asText(input.source.provider), id: asText(input.source.id) }
    : { provider: '', id: '' };
  record.coverUrls = Array.isArray(input.coverUrls)
    ? input.coverUrls.filter((url) => typeof url === 'string' && url.startsWith('https://'))
    : [];
  record.addedAt = asText(input.addedAt) || new Date().toISOString();
  record.updatedAt = asText(input.updatedAt) || record.addedAt;
  return record;
}

/** Deux disques désignent-ils la même édition (même source externe) ? */
export function sameRelease(a, b) {
  return Boolean(a.source?.id) && a.source.provider === b.source?.provider && a.source.id === b.source?.id;
}
