/**
 * Source de données Discogs (bien plus complète que MusicBrainz pour les vinyles).
 *
 * Respecte le même contrat que providers/musicbrainz.js :
 *   searchByBarcode(code)                   -> Promise<Candidate[]>
 *   searchByText({ artist, title, catno })  -> Promise<Candidate[]>
 *
 * La recherche Discogs exige un jeton personnel. Il est fourni par
 * getToken() (voir storage/settings.js) et transmis en paramètre d'URL :
 * aucun en-tête personnalisé, donc pas de requête CORS préalable.
 */

import { DISCOGS_API, DISCOGS_MIN_DELAY_MS, SEARCH_LIMIT } from '../config.js';

export const PROVIDER_ID = 'discogs';

/* ---------- Normalisation (fonctions pures, testées) ---------- */

/** Discogs distingue les homonymes par un suffixe : « Genesis (2) » -> « Genesis ». */
export function cleanArtistName(name = '') {
  return String(name).replace(/\s*\(\d+\)$/, '').trim();
}

/** Le titre d'un résultat de recherche s'écrit « Artiste - Titre ». */
export function splitTitle(fullTitle = '') {
  const text = String(fullTitle);
  const separator = text.indexOf(' - ');
  if (separator === -1) return { artist: '', title: text.trim() };
  return {
    artist: cleanArtistName(text.slice(0, separator)),
    title: text.slice(separator + 3).trim(),
  };
}

/** ["Vinyl", "LP", "Album"] avec quantité 2 -> '2×Vinyl, LP, Album'. */
export function formatDescriptions(formats = [], quantity = 1) {
  const text = [...new Set(formats)].join(', ');
  return text && Number(quantity) > 1 ? `${quantity}×${text}` : text;
}

/**
 * Le champ « barcode » de Discogs mélange code-barres et autres inscriptions
 * (matrices, codes SPARS…) : on garde le premier vrai code EAN/UPC.
 */
export function pickBarcode(values = []) {
  for (const value of values) {
    const digits = String(value).replace(/[\s-]/g, '');
    if (/^\d{8,14}$/.test(digits)) return digits;
  }
  return '';
}

/** Discogs renvoie une image « spacer.gif » quand il n'a pas de pochette. */
function isRealImage(url) {
  return typeof url === 'string' && url.startsWith('https://') && !url.endsWith('spacer.gif');
}

/** Convertit un résultat de recherche Discogs (type « release ») en Candidate. */
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

/** Paramètres de recherche Discogs ; les critères vides sont ignorés. */
export function buildSearchParams({ barcode = '', artist = '', title = '', catno = '' }, token) {
  const params = new URLSearchParams({ type: 'release', per_page: String(SEARCH_LIMIT) });
  const criteria = { barcode, artist, release_title: title, catno };
  for (const [name, value] of Object.entries(criteria)) {
    if (String(value).trim()) params.set(name, String(value).trim());
  }
  params.set('token', token);
  return params;
}

/* ---------- Accès réseau ---------- */

const RETRY_DELAYS_MS = [2000, 5000];

/**
 * @param {object} options
 * @param {() => string} options.getToken - renvoie le jeton personnel (chaîne vide si absent)
 * @param {typeof fetch} [options.fetchFn] - remplaçable dans les tests
 */
export function createDiscogsProvider({ getToken, fetchFn = (...args) => fetch(...args) }) {
  let lastRequestAt = 0;

  async function throttle() {
    const wait = lastRequestAt + DISCOGS_MIN_DELAY_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
  }

  /** Discogs répond 429 quand la limite de débit est atteinte : on réessaie un peu plus tard. */
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
      throw new Error('Discogs refuse le jeton enregistré. Vérifie-le dans les Réglages.');
    }
    if (response.status === 429) {
      throw new Error('Discogs limite temporairement les requêtes. Réessaie dans une minute.');
    }
    if (!response.ok) {
      throw new Error(`Erreur Discogs (${response.status}).`);
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
