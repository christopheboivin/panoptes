/**
 * Library records grouped by artist, for the Collection and Wishlist views.
 * Pure functions.
 *
 * groupByArtist(records) -> [{ key, artist, records }]
 *   key: normalised artist name (case and accents ignored), stable across renders;
 *   artist: the name as stored on the first record;
 *   groups sorted by artist ("The Beatles" filed under B), records by year then title.
 */

import { normalizeText } from './match.js';

/** Sort name of an artist: normalised, without a leading “The ”. */
export function artistSortName(artist) {
  return normalizeText(artist).replace(/^the /, '');
}

function byYearThenTitle(a, b) {
  const yearA = parseInt(a.year, 10) || Infinity;
  const yearB = parseInt(b.year, 10) || Infinity;
  return yearA - yearB || String(a.title).localeCompare(String(b.title));
}

export function groupByArtist(records) {
  const groups = new Map();
  for (const record of records) {
    const key = normalizeText(record.artist);
    if (!groups.has(key)) groups.set(key, { key, artist: record.artist, records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, records: group.records.sort(byYearThenTitle) }))
    .sort((a, b) => artistSortName(a.artist).localeCompare(artistSortName(b.artist)));
}
