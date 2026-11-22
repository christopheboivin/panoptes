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

import {
  DISCOGS_API, DISCOGS_MIN_DELAY_MS, SEARCH_LIMIT, EDITIONS_PAGE_SIZE, MAX_EDITION_PAGES,
} from '../config.js';
import { createThrottle } from './throttle.js';

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
    label: cleanArtistName(result.label?.[0] ?? ''),
    catno: result.catno && result.catno !== 'none' ? result.catno : '',
    barcode: pickBarcode(result.barcode),
    country: result.country ?? '',
    // master_id: the album (“master”); 0 or absent when Discogs has none for this release.
    source: { provider: PROVIDER_ID, id: String(result.id), groupId: result.master_id ? String(result.master_id) : '' },
    coverUrls: [result.cover_image, result.thumb].filter(isRealImage),
  };
}

/**
 * Converts a version of a master (/masters/{id}/versions) into a Candidate.
 * Versions carry neither the artist nor the barcode: the artist is the
 * album's, the barcode stays empty. Their “format” omits the medium, which is
 * in major_formats: ["Vinyl"] + "LP, Album, Mono" -> 'Vinyl, LP, Album, Mono'.
 * @param {object} version
 * @param {object} album - the album (candidate or record) the versions belong to
 */
export function versionToCandidate(version, album) {
  const released = String(version.released ?? '').slice(0, 4);
  return {
    title: version.title || album.title,
    artist: album.artist ?? '',
    year: /^\d{4}$/.test(released) && released !== '0000' ? released : '',
    format: [...(version.major_formats ?? []), version.format].filter(Boolean).join(', '),
    label: cleanArtistName(version.label ?? ''),
    // Several spellings may be listed (“KLP893, KLP-893”): keep the first.
    catno: String(version.catno ?? '').split(',')[0].trim().replace(/^none$/i, ''),
    barcode: '',
    country: version.country ?? '',
    source: { provider: PROVIDER_ID, id: String(version.id), groupId: album.source?.groupId ?? '' },
    coverUrls: [version.thumb].filter(isRealImage),
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {object} options
 * @param {() => string} options.getToken - returns the personal token (empty string if none)
 * @param {typeof fetch} [options.fetchFn] - replaceable in tests
 * @param {(ms: number) => Promise<void>} [options.sleepFn] - replaceable in tests
 */
export function createDiscogsProvider({ getToken, fetchFn = (...args) => fetch(...args), sleepFn = sleep }) {
  const throttle = createThrottle(DISCOGS_MIN_DELAY_MS, { sleep: sleepFn });

  /** Discogs answers 429 when the rate limit is reached: retry a little later. */
  async function getJson(url) {
    let response;
    for (let attempt = 0; ; attempt += 1) {
      await throttle();
      response = await fetchFn(url);
      if (response.status !== 429 || attempt >= RETRY_DELAYS_MS.length) break;
      await sleepFn(RETRY_DELAYS_MS[attempt]);
    }
    if (response.status === 401) {
      throw new Error('Discogs rejects the saved token. Check it in Settings.');
    }
    if (response.status === 429) {
      throw new Error('Discogs is temporarily limiting requests. Try again in a minute.');
    }
    if (!response.ok) {
      throw new Error(`Discogs error (${response.status}).`);
    }
    return response.json();
  }

  async function search(criteria) {
    const token = getToken();
    if (!token) return [];
    const data = await getJson(`${DISCOGS_API}/database/search?${buildSearchParams(criteria, token)}`);
    return (data.results ?? []).map(toCandidate);
  }

  /**
   * All the editions (versions) of an album (master), one page of candidates
   * at a time. Works without a token too (the token raises the rate limit).
   * @param {object} album - a candidate or record with source.groupId
   * @returns {AsyncGenerator<Candidate[]>}
   */
  async function* listEditions(album) {
    const masterId = album.source?.groupId;
    if (!masterId) return;
    for (let page = 1; page <= MAX_EDITION_PAGES; page += 1) {
      const params = new URLSearchParams({ per_page: String(EDITIONS_PAGE_SIZE), page: String(page) });
      const token = getToken();
      if (token) params.set('token', token);
      const data = await getJson(`${DISCOGS_API}/masters/${encodeURIComponent(masterId)}/versions?${params}`);
      yield (data.versions ?? []).map((version) => versionToCandidate(version, album));
      if (page >= (data.pagination?.pages ?? 1)) return;
    }
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
    listEditions,
  };
}
