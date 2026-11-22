/**
 * Discogs data source (far more complete than MusicBrainz for vinyl).
 *
 * Follows the same contract as providers/musicbrainz.js:
 *   searchByBarcode(code)                   -> Promise<Candidate[]>
 *   searchByText({ artist, title, catno })  -> Promise<Candidate[]>
 *
 * Discogs search requires a personal token. It is provided by getToken()
 * (see storage/settings.js) and sent as a URL parameter: no custom header,
 * hence no CORS preflight request.
 */

import { DISCOGS_API, DISCOGS_MIN_DELAY_MS, SEARCH_LIMIT } from '../config.js';

export const PROVIDER_ID = 'discogs';

/* ---------- Normalisation (pure, tested functions) ---------- */

/** Discogs tells namesakes apart with a suffix: “Genesis (2)” -> “Genesis”. */
export function cleanArtistName(name = '') {
  return String(name).replace(/\s*\(\d+\)$/, '').trim();
}

/** A search result's title is written “Artist - Title”. */
export function splitTitle(fullTitle = '') {
  const text = String(fullTitle);
  const separator = text.indexOf(' - ');
  if (separator === -1) return { artist: '', title: text.trim() };
  return {
    artist: cleanArtistName(text.slice(0, separator)),
    title: text.slice(separator + 3).trim(),
  };
}

/** ["Vinyl", "LP", "Album"] with quantity 2 -> '2×Vinyl, LP, Album'. */
export function formatDescriptions(formats = [], quantity = 1) {
  const text = [...new Set(formats)].join(', ');
  return text && Number(quantity) > 1 ? `${quantity}×${text}` : text;
}

/**
 * Discogs's “barcode” field mixes barcodes with other markings (matrix
 * numbers, SPARS codes…): keep the first real EAN/UPC code.
 */
export function pickBarcode(values = []) {
  for (const value of values) {
    const digits = String(value).replace(/[\s-]/g, '');
    if (/^\d{8,14}$/.test(digits)) return digits;
  }
  return '';
}

/** Discogs returns a “spacer.gif” image when it has no cover. */
function isRealImage(url) {
  return typeof url === 'string' && url.startsWith('https://') && !url.endsWith('spacer.gif');
}

/** Converts a Discogs search result (type “release”) into a Candidate. */
export function toCandidate(result) {
  const { artist, title } = splitTitle(result.title);
  return {
    title,
    artist,
    year: result.year ? String(result.year) : '',
    format: formatDescriptions(result.format, result.format_quantity),
    label: result.label?.[0] ?? '',
    catno: result.catno && result.catno !== 'none' ? result.catno : '',
    barcode: pickBarcode(result.barcode),
    country: result.country ?? '',
    source: { provider: PROVIDER_ID, id: String(result.id) },
    coverUrls: [result.cover_image, result.thumb].filter(isRealImage),
  };
}

/** Discogs search parameters; empty criteria are ignored. */
export function buildSearchParams({ barcode = '', artist = '', title = '', catno = '' }, token) {
  const params = new URLSearchParams({ type: 'release', per_page: String(SEARCH_LIMIT) });
  const criteria = { barcode, artist, release_title: title, catno };
  for (const [name, value] of Object.entries(criteria)) {
    if (String(value).trim()) params.set(name, String(value).trim());
  }
  params.set('token', token);
  return params;
}

/* ---------- Network access ---------- */

const RETRY_DELAYS_MS = [2000, 5000];

/**
 * @param {object} options
 * @param {() => string} options.getToken - returns the personal token (empty string if none)
 * @param {typeof fetch} [options.fetchFn] - replaceable in tests
 */
export function createDiscogsProvider({ getToken, fetchFn = (...args) => fetch(...args) }) {
  let lastRequestAt = 0;

  async function throttle() {
    const wait = lastRequestAt + DISCOGS_MIN_DELAY_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
  }

  /** Discogs answers 429 when the rate limit is reached: retry a little later. */
  async function fetchWithRetry(url) {
    for (let attempt = 0; ; attempt += 1) {
      await throttle();
      const response = await fetchFn(url);
      if (response.status !== 429 || attempt >= RETRY_DELAYS_MS.length) return response;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }

  async function search(criteria) {
    const token = getToken();
    if (!token) return [];
    const url = `${DISCOGS_API}/database/search?${buildSearchParams(criteria, token)}`;
    const response = await fetchWithRetry(url);
    if (response.status === 401) {
      throw new Error('Discogs rejects the saved token. Check it in Settings.');
    }
    if (response.status === 429) {
      throw new Error('Discogs is temporarily limiting requests. Try again in a minute.');
    }
    if (!response.ok) {
      throw new Error(`Discogs error (${response.status}).`);
    }
    const data = await response.json();
    return (data.results ?? []).map(toCandidate);
  }

  return {
    id: PROVIDER_ID,
    name: 'Discogs',
    isConfigured: () => Boolean(getToken()),
    searchByBarcode: (code) => (String(code).trim() ? search({ barcode: code }) : Promise.resolve([])),
    searchByText: ({ artist = '', title = '', catno = '' }) => (
      [artist, title, catno].some((value) => String(value).trim())
        ? search({ artist, title, catno })
        : Promise.resolve([])
    ),
  };
}
