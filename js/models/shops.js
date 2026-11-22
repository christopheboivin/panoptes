/**
 * Shop search links for a Wishlist album. Pure functions, no I/O: the links
 * are only written into a page, and followed when the user taps them.
 *
 * shops: [{ name, url }] in the order to offer them, url holding {query}
 * (see SHOPS in config.js).
 */

import { formatFamily } from './editions.js';

/** Search word for the wanted format, in French (the shops are French). */
const FORMAT_WORDS = { Vinyl: 'vinyle', CD: 'cd', Cassette: 'cassette' };

/** Words searched for an album: “artist title vinyle”. */
export function searchWords(album) {
  return [album.artist, album.title, FORMAT_WORDS[formatFamily(album.format)]]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** [{ name, href }] for each shop, in the given order. */
export function shopLinks(album, shops) {
  const query = encodeURIComponent(searchWords(album));
  return shops.map(({ name, url }) => ({ name, href: url.replace('{query}', query) }));
}
