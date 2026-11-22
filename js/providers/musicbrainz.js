/**
 * Source de données MusicBrainz (+ pochettes Cover Art Archive).
 *
 * Contrat d'une source de données (à respecter pour en ajouter une, ex. Discogs) :
 *   searchByBarcode(code)            -> Promise<Candidate[]>
 *   searchByText({ artist, title, catno }) -> Promise<Candidate[]>
 *
 * Un Candidate a la forme attendue par createRecord() :
 *   { title, artist, year, format, label, catno, barcode, country,
 *     source: { provider, id }, coverUrls: string[] }
 */

import { MUSICBRAINZ_API, COVER_ART_API, MUSICBRAINZ_MIN_DELAY_MS, SEARCH_LIMIT } from '../config.js';

export const PROVIDER_ID = 'musicbrainz';

/* ---------- Normalisation (fonctions pures, testées) ---------- */

/** "12\" Vinyl" ×2 -> '2×12" Vinyl' ; plusieurs formats joints par " + ". */
export function formatMedia(media = []) {
  const counts = new Map();
  for (const medium of media) {
    const name = medium?.format || 'Inconnu';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => (n > 1 ? `${n}×${name}` : name)).join(' + ');
}

export function formatArtist(credits = []) {
  return credits.map((c) => `${c.name ?? c.artist?.name ?? ''}${c.joinphrase ?? ''}`).join('').trim();
}

/** Convertit une « release » MusicBrainz en Candidate. */
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
    source: { provider: PROVIDER_ID, id: release.id },
    coverUrls,
  };
}

/** Échappe une valeur pour la syntaxe de recherche Lucene de MusicBrainz. */
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

/* ---------- Accès réseau ---------- */

const RETRY_DELAYS_MS = [1500, 3000, 6000];

let lastRequestAt = 0;

/** Respecte la limite d'une requête par seconde imposée par MusicBrainz. */
async function throttle() {
  const wait = lastRequestAt + MUSICBRAINZ_MIN_DELAY_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

/**
 * MusicBrainz répond 503 quand une limite de débit est atteinte (la nôtre
 * ou la charge globale de ses serveurs). Ces refus sont passagers : on
 * réessaie quelques fois en espaçant les tentatives avant d'abandonner.
 */
async function fetchWithRetry(url) {
  for (let attempt = 0; ; attempt += 1) {
    await throttle();
    const response = await fetch(url);
    if (response.status !== 503 || attempt >= RETRY_DELAYS_MS.length) return response;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}

async function searchReleases(query) {
  const url = `${MUSICBRAINZ_API}/release/?query=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}&fmt=json`;
  const response = await fetchWithRetry(url);
  if (response.status === 503) {
    throw new Error('MusicBrainz refuse temporairement les requêtes (limite de débit). Réessaie dans une minute.');
  }
  if (!response.ok) {
    throw new Error(`Erreur MusicBrainz (${response.status}).`);
  }
  const data = await response.json();
  return (data.releases ?? []).map(toCandidate);
}

/**
 * Un même code s'écrit en UPC-A (12 chiffres) ou en EAN-13 (le même précédé
 * d'un 0) ; MusicBrainz peut avoir enregistré l'une ou l'autre forme.
 */
export function barcodeVariants(code) {
  const digits = String(code).replace(/\D/g, '');
  if (digits.length === 12) return [digits, `0${digits}`];
  if (digits.length === 13 && digits.startsWith('0')) return [digits, digits.slice(1)];
  return digits ? [digits] : [];
}

export function searchByBarcode(code) {
  const variants = barcodeVariants(code);
  if (variants.length === 0) return Promise.resolve([]);
  return searchReleases(`barcode:(${variants.join(' OR ')})`);
}

export function searchByText(criteria) {
  const query = buildTextQuery(criteria);
  return query ? searchReleases(query) : Promise.resolve([]);
}

/** Source prête à être passée à createCatalog() (MusicBrainz ne demande aucun réglage). */
export const provider = Object.freeze({
  id: PROVIDER_ID,
  name: 'MusicBrainz',
  isConfigured: () => true,
  searchByBarcode,
  searchByText,
});
