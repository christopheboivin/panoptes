/**
 * Model of a record in the library.
 *
 * - A Collection record (owned) is one physical copy of a given edition:
 *   several copies of the same edition, or several editions of the same
 *   album, are allowed.
 * - A Wishlist record (wanted) is an album, whatever the edition: it has no
 *   edition details (see toAlbum()).
 *
 * source = { provider, id, groupId }: the data source that found the record,
 * its identifier for the edition (id) and for the album (groupId:
 * MusicBrainz release group or Discogs master). Both identifiers belong to
 * that source only; see models/match.js to compare records across sources.
 *
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

  const source = input.source && typeof input.source === 'object' ? input.source : {};
  record.source = {
    provider: asText(source.provider),
    id: asText(source.id),
    groupId: asText(source.groupId),
  };
  record.coverUrls = Array.isArray(input.coverUrls)
    ? input.coverUrls.filter((url) => typeof url === 'string' && url.startsWith('https://'))
    : [];
  record.addedAt = asText(input.addedAt) || new Date().toISOString();
  record.updatedAt = asText(input.updatedAt) || record.addedAt;
  return record;
}

/**
 * Album-level data of a candidate, for the Wishlist: the details of the
 * edition that happened to be clicked (year, format, label, catalogue
 * number, barcode, country, edition id) are left out on purpose.
 */
export function toAlbum(candidate) {
  return {
    title: candidate.title,
    artist: candidate.artist,
    coverUrls: candidate.coverUrls,
    source: { provider: candidate.source?.provider, id: '', groupId: candidate.source?.groupId },
  };
}
