/** Centralised application settings. */

export const APP_VERSION = '0.8.0';

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

/**
 * Text recognition (OCR) of catalogue numbers: Tesseract.js, hosted in the
 * repository (see vendor/README.md). The engine file is given exactly, so
 * Tesseract neither picks another build nor downloads anything from its CDN.
 */
export const TESSERACT_URL = new URL('../vendor/tesseract/tesseract.esm.min.js', import.meta.url).href;
export const TESSERACT_WORKER_URL = new URL('../vendor/tesseract/worker.min.js', import.meta.url).href;
export const TESSERACT_CORE_URL = new URL('../vendor/tesseract/tesseract-core-simd-lstm.wasm.js', import.meta.url).href;
/** Folder holding eng.traineddata.gz. */
export const TESSERACT_LANG_URL = new URL('../vendor/tesseract', import.meta.url).href;

/** The only characters OCR may recognise: those of catalogue numbers. */
export const CATNO_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -./';

/** Minimum interval between two OCR readings of the camera frame (ms). */
export const OCR_INTERVAL_MS = 700;

/** Below this confidence (0–100), a reading is shown but offers no suggestion. */
export const OCR_MIN_CONFIDENCE = 50;

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

/**
 * Shops for the Wishlist shopping list, in the order they are offered (France).
 * {query} is replaced by the encoded search words (see models/shops.js). The
 * app never contacts these sites: it only writes links, followed when tapped.
 */
export const SHOPS = [
  { name: 'Fnac', url: 'https://www.fnac.com/SearchResult/ResultList.aspx?Search={query}' },
  { name: 'Cultura', url: 'https://www.cultura.com/search/results.html?search_query={query}' },
  // i=popular: the “Musique : CD & Vinyles” department.
  { name: 'Amazon', url: 'https://www.amazon.fr/s?k={query}&i=popular' },
];
