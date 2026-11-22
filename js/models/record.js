/**
 * Model of a record in the library.
 *
 * A record is a disc that is owned (collection) or wanted (wishlist).
 * All library data goes through createRecord() and validateRecord(),
 * which guarantee a stable, serialisable shape.
 */

export const STATUS = Object.freeze({
  OWNED: 'owned',
  WANTED: 'wanted',
});

const STATUSES = new Set(Object.values(STATUS));

/** Optional text fields of a record (always strings, possibly empty). */
const TEXT_FIELDS = ['title', 'artist', 'year', 'format', 'label', 'catno', 'barcode', 'country', 'notes'];

function newId() {
  return globalThis.crypto.randomUUID();
}

function asText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/**
 * Creates a record from an identification candidate (see providers/).
 * @param {object} candidate - descriptive data (title, artist, source…)
 * @param {string} status - STATUS.OWNED or STATUS.WANTED
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
 * Checks and normalises a record (used on creation and on import).
 * Throws an explicit error if the record is unusable.
 */
export function validateRecord(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid record: object expected.');
  }
  if (typeof input.id !== 'string' || input.id === '') {
    throw new Error('Invalid record: missing identifier.');
  }
  if (!STATUSES.has(input.status)) {
    throw new Error(`Invalid record: unknown status “${input.status}”.`);
  }

  const record = { id: input.id, status: input.status };
  for (const field of TEXT_FIELDS) {
    record[field] = asText(input[field]);
  }
  if (!record.title) {
    throw new Error('Invalid record: missing title.');
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

/** Do two records refer to the same release (same external source)? */
export function sameRelease(a, b) {
  return Boolean(a.source?.id) && a.source.provider === b.source?.provider && a.source.id === b.source?.id;
}
