/** Centralised application settings. */

export const APP_VERSION = '0.4.0';

/**
 * Fallback barcode reading engine, loaded only when the browser has no
 * built-in one (Firefox in particular).
 * Hosted in the repository (see vendor/README.md): the page loads no
 * third-party script. Addresses are resolved relative to this file, which
 * also works from a subfolder (e.g. GitHub Pages).
 */
export const BARCODE_POLYFILL_URL = new URL('../vendor/barcode-detector/pure.js', import.meta.url).href;

/** WebAssembly file of the ZXing reader, used by the engine above. */
export const ZXING_WASM_URL = new URL('../vendor/zxing-wasm/zxing_reader.wasm', import.meta.url).href;

/** Barcode formats found on records (EAN/UPC). */
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** Interval between two analyses of a camera frame (ms). */
export const SCAN_INTERVAL_MS = 250;

export const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
export const COVER_ART_API = 'https://coverartarchive.org';

/** MusicBrainz allows one request per second. */
export const MUSICBRAINZ_MIN_DELAY_MS = 1100;

/**
 * Results per search. Results are grouped by album, and an album often has
 * many editions: ask for enough of them to show several albums.
 */
export const SEARCH_LIMIT = 50;

/** Editions of an album: requested by pages of this size (the maximum for both sources)… */
export const EDITIONS_PAGE_SIZE = 100;

/** …and at most this many pages (some albums have over a thousand editions). */
export const MAX_EDITION_PAGES = 10;

export const DISCOGS_API = 'https://api.discogs.com';

/** Discogs allows 60 requests per minute with a personal token. */
export const DISCOGS_MIN_DELAY_MS = 1100;

/** Discogs page where a personal token is created. */
export const DISCOGS_TOKEN_PAGE = 'https://www.discogs.com/settings/developers';
