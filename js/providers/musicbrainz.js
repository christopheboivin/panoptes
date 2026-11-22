/**
 * MusicBrainz data source (+ covers from Cover Art Archive).
 *
 * Data source contract (to follow when adding another one, see discogs.js):
 *   { id, name, isConfigured(),
 *     searchByBarcode(code)                  -> Promise<Candidate[]>
 *     searchByText({ artist, title, catno }) -> Promise<Candidate[]>
 *     listEditions(album)                    -> AsyncGenerator<Candidate[]> (optional)
 *   }
 * listEditions yields the editions of album.source.groupId page by page.
 *
 * A Candidate has the shape expected by createRecord():
 *   { title, artist, year, format, label, catno, barcode, country,
 *     source: { provider, id, groupId }, coverUrls: string[] }
 * (id identifies the edition, groupId the album; groupId may be empty.)
 */

import {
  MUSICBRAINZ_API, COVER_ART_API, MUSICBRAINZ_MIN_DELAY_MS, SEARCH_LIMIT, EDITIONS_PAGE_SIZE, MAX_EDITION_PAGES,
} from '../config.js';
import { createThrottle } from './throttle.js';

export const PROVIDER_ID = 'musicbrainz';

/* ---------- Normalisation (pure, tested functions) ---------- */

/** "12\" Vinyl" ×2 -> '2×12" Vinyl'; several formats joined with " + ". */
export function formatMedia(media = []) {
  const counts = new Map();
  for (const medium of media) {
    const name = medium?.format || 'Unknown';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => (n > 1 ? `${n}×${name}` : name)).join(' + ');
}

export function formatArtist(credits = []) {
  return credits.map((c) => `${c.name ?? c.artist?.name ?? ''}${c.joinphrase ?? ''}`).join('').trim();
}

/** Converts a MusicBrainz release into a Candidate. */
export function toCandidate(release) {
  const labelInfo = release['label-info']?.[0];
  const releaseGroupId = release['release-group']?.id;
  const coverUrls = [`${COVER_ART_API}/release/${release.id}/front-250`];
  if (releaseGroupId) coverUrls.push(`${COVER_ART_API}/release-group/${releaseGroupId}/front-250`);

  return {
    title: release.title ?? '',
    artist: formatArtist(release['artist-credit']),
    year: (release.date ?? '').slice(0, 4),
    format: formatMedia(release.media),
    label: labelInfo?.label?.name ?? '',
    catno: labelInfo?.['catalog-number'] ?? '',
    barcode: release.barcode ?? '',
    country: release.country ?? '',
    source: { provider: PROVIDER_ID, id: release.id, groupId: releaseGroupId ?? '' },
    coverUrls,
  };
}

/** Escapes a value for MusicBrainz's Lucene search syntax. */
export function luceneQuote(value) {
  return `"${String(value).replace(/[\\"]/g, '\\$&')}"`;
}

export function buildTextQuery({ artist = '', title = '', catno = '' }) {
  const parts = [];
  if (artist.trim()) parts.push(`artist:${luceneQuote(artist.trim())}`);
  if (title.trim()) parts.push(`release:${luceneQuote(title.trim())}`);
  if (catno.trim()) parts.push(`catno:${luceneQuote(catno.trim())}`);
  return parts.join(' AND ');
}

/* ---------- Network access ---------- */

const RETRY_DELAYS_MS = [1500, 3000, 6000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The same code can be written as UPC-A (12 digits) or EAN-13 (the same
 * preceded by a 0); MusicBrainz may have recorded either form.
 */
export function barcodeVariants(code) {
  const digits = String(code).replace(/\D/g, '');
  if (digits.length === 12) return [digits, `0${digits}`];
  if (digits.length === 13 && digits.startsWith('0')) return [digits, digits.slice(1)];
  return digits ? [digits] : [];
}

/**
 * Creates the MusicBrainz source, ready to be passed to createCatalog()
 * (MusicBrainz needs no settings). Create it once: the instance enforces
 * the limit of one request per second.
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchFn] - replaceable in tests
 * @param {(ms: number) => Promise<void>} [options.sleepFn] - replaceable in tests
 */
export function createMusicBrainzProvider({ fetchFn = (...args) => fetch(...args), sleepFn = sleep } = {}) {
  const throttle = createThrottle(MUSICBRAINZ_MIN_DELAY_MS, { sleep: sleepFn });

  /**
   * MusicBrainz answers 503 when a rate limit is reached (ours, or the
   * overall load on its servers). These refusals are temporary: retry a few
   * times, spacing out the attempts, before giving up.
   */
  async function getJson(url) {
    let response;
    for (let attempt = 0; ; attempt += 1) {
      await throttle();
      response = await fetchFn(url);
      if (response.status !== 503 || attempt >= RETRY_DELAYS_MS.length) break;
      await sleepFn(RETRY_DELAYS_MS[attempt]);
    }
    if (response.status === 503) {
      throw new Error('MusicBrainz is temporarily refusing requests (rate limit). Try again in a minute.');
    }
    if (!response.ok) {
      throw new Error(`MusicBrainz error (${response.status}).`);
    }
    return response.json();
  }

  async function searchReleases(query) {
    const url = `${MUSICBRAINZ_API}/release/?query=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}&fmt=json`;
    const data = await getJson(url);
    return (data.releases ?? []).map(toCandidate);
  }

  /**
   * All the editions (releases) of an album (release group), one page of
   * candidates at a time, as they arrive.
   * @param {object} album - a candidate or record with source.groupId
   * @returns {AsyncGenerator<Candidate[]>}
   */
  async function* listEditions(album) {
    const groupId = album.source?.groupId;
    if (!groupId) return;
    let offset = 0;
    for (let page = 0; page < MAX_EDITION_PAGES; page += 1) {
      const url = `${MUSICBRAINZ_API}/release?release-group=${encodeURIComponent(groupId)}`
        + `&inc=artist-credits+labels+media&limit=${EDITIONS_PAGE_SIZE}&offset=${offset}&fmt=json`;
      const data = await getJson(url);
      const releases = data.releases ?? [];
      // Browsed releases do not repeat their release group: it is the album's.
      yield releases.map((release) => toCandidate({ ...release, 'release-group': { id: groupId } }));
      offset += releases.length;
      if (releases.length === 0 || offset >= (data['release-count'] ?? 0)) return;
    }
  }

  return {
    id: PROVIDER_ID,
    name: 'MusicBrainz',
    isConfigured: () => true,
    searchByBarcode(code) {
      const variants = barcodeVariants(code);
      return variants.length ? searchReleases(`barcode:(${variants.join(' OR ')})`) : Promise.resolve([]);
    },
    searchByText(criteria) {
      const query = buildTextQuery(criteria);
      return query ? searchReleases(query) : Promise.resolve([]);
    },
    listEditions,
  };
}
