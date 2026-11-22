/**
 * Albums and editions: grouping of search results by album, and sorting /
 * filtering of the editions shown in the edition picker. Pure functions.
 */

import { normalizeText, normalizeCatno } from './match.js';

/**
 * Groups search candidates by album (same source, same source.groupId), in
 * the order of their first appearance. A candidate without an album
 * identifier is an album of its own.
 * @returns {Array<{ album: object, editions: object[] }>} album: the first edition found, used to show the album
 */
export function groupByAlbum(candidates) {
  const groups = new Map();
  candidates.forEach((candidate, index) => {
    const { provider = '', groupId = '', id = '' } = candidate.source ?? {};
    const key = groupId ? `${provider}/album/${groupId}` : `${provider}/edition/${id || index}`;
    if (!groups.has(key)) groups.set(key, { album: candidate, editions: [] });
    groups.get(key).editions.push(candidate);
  });
  return [...groups.values()];
}

const FAMILIES = [
  ['Vinyl', /vinyl|\d+"/i],
  ['CD', /\b(?:cd|sacd|hdcd|dualdisc)\b|\bcd-?r\b/i],
  ['Cassette', /cassette/i],
  ['Digital', /digital|file/i],
];

/** Broad format family, for filtering: '12" Vinyl' -> 'Vinyl', 'Hybrid SACD' -> 'CD'. */
export function formatFamily(format) {
  const text = String(format ?? '').trim();
  if (!text || /^unknown$/i.test(text)) return 'Unknown';
  for (const [family, pattern] of FAMILIES) {
    if (pattern.test(text)) return family;
  }
  return 'Other';
}

const isVinyl = (item) => formatFamily(item.format) === 'Vinyl';

/** Search results with the vinyl editions first, the order being kept otherwise (Wishlist: vinyl first). */
export function vinylFirst(candidates) {
  return [...candidates.filter(isVinyl), ...candidates.filter((item) => !isVinyl(item))];
}

/** Number of vinyl editions in a list. */
export function countVinyl(editions) {
  return editions.filter(isVinyl).length;
}

/** Oldest first (unknown years last), then by country, format, label and catalogue number. */
export function sortEditions(editions) {
  const fields = ['country', 'format', 'label', 'catno'];
  return [...editions].sort((a, b) => (a.year || '9999').localeCompare(b.year || '9999')
    || fields.reduce((order, field) => order || String(a[field] ?? '').localeCompare(String(b[field] ?? '')), 0));
}

function countValues(values) {
  const counts = new Map();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Choices offered by the picker's filters, most frequent first: { formats, countries } of { value, count }. */
export function filterOptions(editions) {
  return {
    formats: countValues(editions.map((edition) => formatFamily(edition.format))),
    countries: countValues(editions.map((edition) => edition.country)),
  };
}

/**
 * Editions matching the picker's filters (empty filter = no constraint).
 * text: words to find in the year, label, catalogue number, barcode, country
 * or format; “CL1355” also finds “CL 1355”.
 */
export function filterEditions(editions, { format = '', country = '', text = '' } = {}) {
  const words = normalizeText(text).split(' ').filter(Boolean);
  return editions.filter((edition) => {
    if (format && formatFamily(edition.format) !== format) return false;
    if (country && edition.country !== country) return false;
    if (words.length === 0) return true;
    const haystack = `${normalizeText([edition.year, edition.label, edition.catno, edition.barcode, edition.country, edition.format].join(' '))} ${normalizeCatno(edition.catno).toLowerCase()}`;
    return words.every((word) => haystack.includes(word));
  });
}
