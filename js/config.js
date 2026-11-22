/** Réglages centralisés de l'application. */

export const APP_VERSION = '0.2.0';

/**
 * Moteur de lecture de codes-barres de secours, chargé uniquement si le
 * navigateur n'en fournit pas (Firefox notamment).
 * Hébergé dans le dépôt (voir vendor/README.md) : la page ne charge aucun
 * script tiers. Les adresses sont calculées à partir de ce fichier, ce qui
 * fonctionne aussi dans un sous-dossier (ex. GitHub Pages).
 */
export const BARCODE_POLYFILL_URL = new URL('../vendor/barcode-detector/pure.js', import.meta.url).href;

/** Fichier WebAssembly du lecteur ZXing, utilisé par le moteur ci-dessus. */
export const ZXING_WASM_URL = new URL('../vendor/zxing-wasm/zxing_reader.wasm', import.meta.url).href;

/** Formats de codes-barres présents sur les disques (EAN/UPC). */
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** Intervalle entre deux analyses d'image de la caméra (ms). */
export const SCAN_INTERVAL_MS = 250;

export const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
export const COVER_ART_API = 'https://coverartarchive.org';

/** MusicBrainz limite à une requête par seconde. */
export const MUSICBRAINZ_MIN_DELAY_MS = 1100;

export const SEARCH_LIMIT = 15;

export const DISCOGS_API = 'https://api.discogs.com';

/** Discogs limite à 60 requêtes par minute avec un jeton personnel. */
export const DISCOGS_MIN_DELAY_MS = 1100;

/** Page Discogs où l'on crée son jeton personnel. */
export const DISCOGS_TOKEN_PAGE = 'https://www.discogs.com/settings/developers';
