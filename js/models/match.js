/**
 * Comparison of records and search candidates: same edition? same album?
 *
 * Source identifiers (source.id, source.groupId) only compare items found by
 * the same source. Across sources, the barcode, the label + catalogue number
 * and the artist + title are used instead. Results are graded:
 *   MATCH.SAME     - reliable (same identifier, same barcode…)
 *   MATCH.PROBABLE - likely only (same names…): to be worded as a hint
 *   MATCH.NONE     - no relation found
 *
 * Nothing here blocks an addition: several copies of an edition and several
 * editions of an album are allowed. These results only inform the user.
 * Pure functions, no I/O.
 */

import { canonicalBarcode } from './barcode.js';
import { STATUS } from './record.js';

export const MATCH = Object.freeze({ SAME: 'same', PROBABLE: 'probable', NONE: '' });

/** Lower case, accents and punctuation removed, “&” read as “and”, single spaces. */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Catalogue numbers are written with or without spaces, dashes or dots: “CL 1355” = “CL-1355”. */
export function normalizeCatno(value) {
  return String(value ?? '').toUpperCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Normalised values of an item, computed once per object. */
const keysCache = new WeakMap();
function keys(item) {
  let cached = keysCache.get(item);
  if (!cached) {
    cached = {
      provider: item.source?.provider ?? '',
      id: item.source?.id ?? '',
      groupId: item.source?.groupId ?? '',
      barcode: canonicalBarcode(item.barcode),
      catno: normalizeCatno(item.catno),
      label: normalizeText(item.label),
      country: String(item.country ?? '').trim(),
      title: normalizeText(item.title),
      artist: normalizeText(item.artist),
    };
    keysCache.set(item, cached);
  }
  return cached;
}

/** Is b the same edition (pressing) as a? */
export function editionMatch(a, b) {
  const ka = keys(a);
  const kb = keys(b);
  if (ka.provider && ka.provider === kb.provider && ka.id && ka.id === kb.id) return MATCH.SAME;
  if (ka.barcode && ka.barcode === kb.barcode) return MATCH.SAME;
  // Without a barcode (older records): label + catalogue number. Sources spell
  // label names differently, so a missing label does not prevent the match.
  const labelsAgree = !ka.label || !kb.label || ka.label === kb.label;
  if (ka.catno && ka.catno === kb.catno && labelsAgree) {
    // The same number is sometimes reused for other countries' pressings.
    return ka.country && kb.country && ka.country !== kb.country ? MATCH.PROBABLE : MATCH.SAME;
  }
  return MATCH.NONE;
}

/** Is b an edition of the same album as a? */
export function albumMatch(a, b) {
  const ka = keys(a);
  const kb = keys(b);
  if (ka.provider && ka.provider === kb.provider && ka.groupId && kb.groupId) {
    // Same source: its album identifiers are decisive, even when the names are
    // equal (two different “Greatest Hits”, for instance).
    return ka.groupId === kb.groupId ? MATCH.SAME : MATCH.NONE;
  }
  if (ka.title && ka.title === kb.title && ka.artist === kb.artist) return MATCH.PROBABLE;
  return MATCH.NONE;
}

/**
 * What the library holds in relation to an item (search candidate or record).
 * The item itself (same record id) is ignored.
 * @returns {{ copies: Match[], otherEditions: Match[], wanted: Match[] }}
 *   Match = { record, level }:
 *   - copies: Collection records of the same edition;
 *   - otherEditions: Collection records of another edition of the same album;
 *   - wanted: Wishlist albums matching the item's album.
 */
export function findRelations(item, records) {
  const relations = { copies: [], otherEditions: [], wanted: [] };
  for (const record of records) {
    if (item.id && record.id === item.id) continue;
    if (record.status === STATUS.WANTED) {
      const level = albumMatch(item, record);
      if (level) relations.wanted.push({ record, level });
      continue;
    }
    const edition = editionMatch(item, record);
    if (edition) {
      relations.copies.push({ record, level: edition });
      continue;
    }
    const album = albumMatch(item, record);
    if (album) relations.otherEditions.push({ record, level: album });
  }
  return relations;
}

/** True if at least one match is reliable. */
export function isCertain(matches) {
  return matches.some((match) => match.level === MATCH.SAME);
}
