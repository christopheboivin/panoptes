/**
 * Entry point: screen state and event wiring.
 * Business logic lives in storage/, providers/, identify/ and scanner/.
 */

import { APP_VERSION, DISCOGS_TOKEN_PAGE } from './config.js';
import * as db from './storage/db.js';
import { createLibrary, STATUS } from './storage/library.js';
import { createSettings } from './storage/settings.js';
import { findRelations, isCertain } from './models/match.js';
import {
  groupByAlbum, sortEditions, filterOptions, filterEditions,
} from './models/editions.js';
import { createMusicBrainzProvider } from './providers/musicbrainz.js';
import { createDiscogsProvider } from './providers/discogs.js';
import { createCatalog } from './providers/catalog.js';
import { isValidBarcode, normalizeBarcode } from './models/barcode.js';
import { identifyImage, hasImageIdentifiers } from './identify/index.js';
import { startLiveScan } from './scanner/camera.js';
import { readBarcodeFromImage } from './scanner/barcode-engine.js';
import {
  renderLibrary, renderCandidates, renderAlbums, renderEditions, renderFilterOptions,
} from './ui/render.js';

const library = createLibrary(db);
const settings = createSettings();
// Query order: MusicBrainz first, Discogs if MusicBrainz finds nothing.
const catalog = createCatalog([
  createMusicBrainzProvider(),
  createDiscogsProvider({ getToken: settings.getDiscogsToken }),
]);

/** How search results are shown: grouped by album (text search) or edition by edition (barcode). */
const RESULTS = Object.freeze({ ALBUMS: 'albums', EDITIONS: 'editions' });

const state = {
  records: [],
  /** findRelations() of each record (copies, other editions, wishlist), by record id. */
  relations: new Map(),
  status: STATUS.OWNED,
  filter: '',
  candidates: [],
  candidatesSource: '',
  resultsMode: RESULTS.EDITIONS,
  /** Results grouped by album (RESULTS.ALBUMS mode): groupByAlbum(candidates). */
  albums: [],
  /** Edition picker: { album, editions, filters: { format, country, text }, loading, error } or null. */
  picker: null,
  /** Scroll position of the results, restored when leaving the picker. */
  resultsScroll: 0,
  stopScan: null,
};

const $ = (id) => document.getElementById(id);
const els = {
  library: $('library'),
  filter: $('filter'),
  dialog: $('add-dialog'),
  scanner: $('scanner'),
  video: $('scan-video'),
  status: $('status'),
  candidates: $('candidates'),
  searchForm: $('search-form'),
  toast: $('toast'),
  settingsDialog: $('settings-dialog'),
  settingsForm: $('settings-form'),
  tokenState: $('discogs-token-state'),
  searchView: $('search-view'),
  picker: $('picker'),
  pickerTitle: $('picker-title'),
  pickerArtist: $('picker-artist'),
  pickerFormat: $('picker-format'),
  pickerCountry: $('picker-country'),
  pickerText: $('picker-text'),
  pickerStatus: $('picker-status'),
  pickerList: $('picker-list'),
};

/* ---------- Display ---------- */

function matchesFilter(record, filter) {
  if (!filter) return true;
  const haystack = [record.title, record.artist, record.label, record.catno, record.barcode].join(' ').toLowerCase();
  return haystack.includes(filter);
}

function render() {
  const visible = state.records
    .filter((r) => r.status === state.status && matchesFilter(r, state.filter))
    .sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  els.library.innerHTML = renderLibrary(visible, state, state.relations);

  for (const status of Object.values(STATUS)) {
    $(`count-${status}`).textContent = state.records.filter((r) => r.status === status).length;
  }
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.setAttribute('aria-pressed', String(tab.dataset.status === state.status));
  });
}

function renderCandidateList() {
  if (state.resultsMode === RESULTS.ALBUMS) {
    state.albums = groupByAlbum(state.candidates);
    const items = state.albums.map(({ album, editions }) => ({
      album,
      editionCount: editions.length,
      relations: findRelations(album, state.records),
      canPick: catalog.canListEditions(album),
    }));
    els.candidates.innerHTML = renderAlbums(items, state.candidatesSource);
    return;
  }
  const items = state.candidates.map((candidate) => ({
    candidate,
    relations: findRelations(candidate, state.records),
    canPick: catalog.canListEditions(candidate),
  }));
  els.candidates.innerHTML = renderCandidates(items, state.candidatesSource);
}

async function reload() {
  state.records = await library.list();
  state.relations = new Map(state.records.map((record) => [record.id, findRelations(record, state.records)]));
  render();
}

/** reload() for event handlers: a storage failure is shown, never thrown. */
function refresh() {
  return reload().catch((error) => toast(`Storage unavailable: ${error.message}`));
}

let toastTimer = null;
function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3500);
}

function setStatus(message, tone = '') {
  els.status.textContent = message;
  els.status.dataset.tone = tone;
}

/** Replaces a missing cover with the next fallback URL. */
function handleCoverError(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('cover')) return;
  const [next, ...rest] = (img.dataset.fallbacks || '').split(' ').filter(Boolean);
  if (next) {
    img.dataset.fallbacks = rest.join(' ');
    img.src = next;
  } else {
    img.replaceWith(Object.assign(document.createElement('div'), { className: 'cover cover--empty' }));
  }
}

/* ---------- Search and identification ---------- */

/** Number of the latest search: results of an older one are ignored. */
let searchId = 0;

/** The search in progress, if any, no longer matters (new search, new scan, dialog reopened). */
function cancelSearch() {
  searchId += 1;
}

/**
 * Runs a search and displays its results.
 * search() returns { candidates, providerName?, skipped?, detail? }; runSearch returns
 * that result, or null on error (already shown to the user) or when a newer
 * search or scan replaced this one (nothing is shown).
 * @param {string} mode - RESULTS.ALBUMS or RESULTS.EDITIONS
 */
async function runSearch(label, search, mode = RESULTS.EDITIONS) {
  cancelSearch();
  const id = searchId;
  state.candidates = [];
  state.candidatesSource = '';
  state.resultsMode = mode;
  renderCandidateList();
  setStatus(`${label}…`);
  try {
    const result = await search();
    if (id !== searchId) return null;
    state.candidates = result.candidates;
    state.candidatesSource = result.providerName ?? '';
    renderCandidateList();
    const count = mode === RESULTS.ALBUMS ? state.albums.length : result.candidates.length;
    const noun = mode === RESULTS.ALBUMS ? 'album' : 'result';
    const where = result.providerName ? ` on ${result.providerName}` : '';
    const summary = count === 0 ? 'No record found.' : `${count} ${noun}${count > 1 ? 's' : ''}${where}.`;
    setStatus([result.detail, summary, discogsHint(result)].filter(Boolean).join(' '));
    return result;
  } catch (error) {
    if (id === searchId) setStatus(error.message, 'warn');
    return null;
  }
}

/** Suggests setting up Discogs when it could not be searched for lack of a token. */
function discogsHint(result) {
  return result.candidates.length === 0 && result.skipped?.includes('Discogs')
    ? 'Tip: add a Discogs token in Settings to search Discogs as well; it is far more complete for vinyl.'
    : '';
}

/**
 * Confirmation step: the scanned code is put in the “Barcode” field and
 * nothing is looked up until the user confirms.
 */
function proposeBarcode(code) {
  cancelSearch();
  const digits = normalizeBarcode(code);
  state.candidates = [];
  renderCandidateList();
  els.searchForm.elements.barcode.value = digits;
  if (isValidBarcode(digits)) {
    setStatus(`Barcode read: ${digits} (check digit OK). Compare it with the one on the record, then press “Search”.`, 'ok');
  } else {
    setStatus(`Code read: ${digits || code}, but its check digit is wrong. Scan again or correct it before searching.`, 'warn');
  }
  els.searchForm.querySelector('button[type="submit"]').focus();
}

async function searchFromPhoto(file) {
  setStatus('Reading the barcode on the photo…');
  try {
    const code = await readBarcodeFromImage(file);
    if (code) {
      proposeBarcode(code);
    } else if (hasImageIdentifiers()) {
      await runSearch('Analysing the photo', () => identifyImage(file));
    } else {
      setStatus('No readable barcode on the photo. Take a sharper one, or type the code in.', 'warn');
    }
  } catch (error) {
    setStatus(error.message, 'warn');
  }
}

async function searchByBarcode(code) {
  const result = await runSearch(`Searching for barcode ${code}`, async () => ({
    ...(await catalog.searchByBarcode(code)),
    detail: `Barcode ${code}.`,
  }));
  if (result && result.candidates.length === 0) {
    const where = result.skipped.includes('Discogs') ? 'MusicBrainz' : 'MusicBrainz or Discogs';
    setStatus([
      `Barcode ${code} is not listed on ${where}.`,
      'Search by artist and title, or by catalogue number: this code will be saved with the record you pick.',
      discogsHint(result),
    ].filter(Boolean).join(' '), 'warn');
    els.searchForm.elements.artist.focus();
  }
}

/**
 * Scan session number: incremented by every stop, so that a camera that
 * finishes starting after the user cancelled (dialog closed while the
 * permission prompt was open, for instance) is stopped at once.
 */
let scanSession = 0;

function stopScanning() {
  scanSession += 1;
  state.stopScan?.();
  state.stopScan = null;
  els.scanner.hidden = true;
}

async function startScanning() {
  stopScanning();
  const session = scanSession;
  els.scanner.hidden = false;
  setStatus('Point the camera at the record\'s barcode.');
  try {
    const stop = await startLiveScan(els.video, (code) => {
      if (session !== scanSession) return;
      state.stopScan = null;
      els.scanner.hidden = true;
      navigator.vibrate?.(80);
      proposeBarcode(code);
    });
    if (session !== scanSession) {
      stop(); // cancelled while the camera was starting
      return;
    }
    state.stopScan = stop;
  } catch (error) {
    if (session !== scanSession) return;
    els.scanner.hidden = true;
    setStatus(error.message);
  }
}

/* ---------- Edition picker ---------- */

/** Shows the picker instead of the search (or back), keeping the results' scroll position. */
function showPicker(visible) {
  if (visible && !els.searchView.hidden) state.resultsScroll = els.dialog.scrollTop;
  els.searchView.hidden = visible;
  els.picker.hidden = !visible;
  els.dialog.scrollTop = visible ? 0 : state.resultsScroll;
}

/**
 * Opens the picker on an album and loads its editions page by page, showing
 * them as they arrive. Leaving the picker (or any new search) stops the loading.
 */
async function openPicker(album) {
  stopScanning();
  cancelSearch();
  const id = searchId;
  state.picker = { album, editions: [], filters: { format: '', country: '', text: '' }, loading: true, error: '' };
  els.pickerTitle.textContent = album.title;
  els.pickerArtist.textContent = [album.artist, catalog.sourceName(album)].filter(Boolean).join(' · ');
  els.pickerText.value = '';
  showPicker(true);
  renderPicker();
  try {
    for await (const page of catalog.listEditions(album)) {
      if (id !== searchId) return; // also stops the loading of the next pages
      state.picker.editions = sortEditions([...state.picker.editions, ...page]);
      renderPicker();
    }
  } catch (error) {
    if (id !== searchId) return;
    state.picker.error = error.message;
  }
  if (id !== searchId) return;
  state.picker.loading = false;
  renderPicker();
}

function closePicker() {
  cancelSearch();
  state.picker = null;
  showPicker(false);
  renderCandidateList();
}

/** Last <option>s written, so that they are only rewritten when they change (an open list would close). */
const filterHtml = { format: '', country: '' };

function renderPicker() {
  const { picker } = state;
  if (!picker) return;
  const { formats, countries } = filterOptions(picker.editions);
  const formatHtml = renderFilterOptions('All formats', formats, picker.filters.format);
  const countryHtml = renderFilterOptions('All countries', countries, picker.filters.country);
  if (formatHtml !== filterHtml.format) els.pickerFormat.innerHTML = filterHtml.format = formatHtml;
  if (countryHtml !== filterHtml.country) els.pickerCountry.innerHTML = filterHtml.country = countryHtml;

  const positions = new Map(picker.editions.map((edition, index) => [edition, index]));
  const visible = filterEditions(picker.editions, picker.filters);
  els.pickerList.innerHTML = renderEditions(visible.map((edition) => ({
    edition,
    index: positions.get(edition),
    relations: findRelations(edition, state.records),
  })));

  const total = picker.editions.length;
  const shown = visible.length === total ? `${total} edition${total === 1 ? '' : 's'}` : `${visible.length} of ${total} editions`;
  els.pickerStatus.textContent = picker.error
    ? `${picker.error}${total ? ` (${total} editions loaded)` : ''}`
    : picker.loading
      ? `Loading editions… ${total} so far.`
      : total === 0 ? 'No edition found for this album.' : `${shown}. Compare with the label, the spine or the back cover.`;
}

/**
 * “Got it” on a Wishlist album: the picker asks which edition is owned;
 * adding it to the Collection then offers to remove the album from the
 * Wishlist (see offerToRemoveFromWishlist). An album whose editions cannot be
 * listed (added before album identifiers existed) is searched by name instead.
 */
function findEditionsOf(album) {
  openAddDialog();
  if (catalog.canListEditions(album)) {
    openPicker(album);
    return;
  }
  els.searchForm.elements.artist.value = album.artist;
  els.searchForm.elements.title.value = album.title;
  const criteria = { artist: album.artist, title: album.title, catno: '' };
  runSearch(`Searching for “${album.title}”`, async () => ({
    ...(await catalog.searchByText(criteria)),
    detail: 'Choose the album, then “I own it…” to pick your edition.',
  }), RESULTS.ALBUMS);
}

/**
 * Adds a search result or an edition: a copy to the Collection, or its album
 * to the Wishlist. The scanned barcode is kept when the source does not know
 * the edition's.
 */
async function addToLibrary(candidate, status) {
  const scanned = normalizeBarcode(els.searchForm.elements.barcode.value);
  const data = status === STATUS.OWNED && !candidate.barcode && scanned ? { ...candidate, barcode: scanned } : candidate;
  // Computed before adding: the new record must not count as a match of itself.
  const { wanted } = findRelations(data, state.records);
  try {
    const record = await library.add(data, status);
    toast(`“${record.title}” added to your ${status === STATUS.OWNED ? 'collection' : 'wishlist'}.`);
    if (status === STATUS.OWNED) await offerToRemoveFromWishlist(wanted);
  } catch (error) {
    toast(`Could not add this record: ${error.message}`);
  }
  await refresh();
}

/** Asks whether to remove from the Wishlist the album of an edition just added to the Collection. */
async function offerToRemoveFromWishlist(wanted) {
  if (wanted.length === 0) return;
  const [{ record }] = wanted;
  const question = isCertain(wanted)
    ? `“${record.title}” is on your wishlist. Remove it now that you own an edition?`
    : `Your wishlist contains “${record.title}”${record.artist ? ` by ${record.artist}` : ''}, which looks like the same album. Remove it from your wishlist?`;
  if (!window.confirm(question)) return;
  for (const match of wanted) await library.remove(match.record.id);
  toast(`“${record.title}” removed from your wishlist.`);
}

function openAddDialog() {
  cancelSearch();
  state.picker = null;
  showPicker(false);
  state.candidates = [];
  renderCandidateList();
  setStatus('');
  els.searchForm.reset();
  els.dialog.showModal();
}

/* ---------- Settings ---------- */

function renderTokenState() {
  els.tokenState.textContent = settings.getDiscogsToken()
    ? 'A token is saved on this device.'
    : 'No token saved: only MusicBrainz is searched.';
}

function openSettings() {
  els.settingsForm.reset(); // the saved token is never displayed again
  renderTokenState();
  els.settingsDialog.showModal();
}

function saveDiscogsToken(token) {
  try {
    settings.setDiscogsToken(token);
    renderTokenState();
    els.settingsForm.reset();
    toast(token.trim() ? 'Discogs token saved.' : 'Discogs token deleted.');
  } catch (error) {
    toast(error.message);
  }
}

/* ---------- Export / import ---------- */

async function exportLibrary() {
  const data = await library.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `panoptes-export-${data.exportedAt.slice(0, 10)}.json`,
  });
  link.click();
  URL.revokeObjectURL(url);
  toast(`${data.records.length} record(s) exported.`);
}

async function importLibrary(file) {
  try {
    const data = JSON.parse(await file.text());
    const { imported, rejected } = await library.importData(data);
    await reload();
    toast(`${imported} record(s) imported${rejected ? `, ${rejected} skipped as invalid` : ''}.`);
  } catch (error) {
    toast(error instanceof SyntaxError ? 'Unreadable file: invalid JSON.' : error.message);
  }
}

/* ---------- Events ---------- */

function bindEvents() {
  document.querySelector('.tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    state.status = tab.dataset.status;
    render();
  });

  els.filter.addEventListener('input', () => {
    state.filter = els.filter.value.trim().toLowerCase();
    render();
  });

  els.library.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const record = state.records.find((r) => r.id === button.dataset.id);
    if (!record) return;
    if (button.dataset.action === 'acquire') {
      findEditionsOf(record);
      return;
    }
    try {
      if (button.dataset.action === 'remove') {
        if (!window.confirm(`Remove “${record.title}”?`)) return;
        await library.remove(record.id);
      }
    } catch (error) {
      toast(`Could not update “${record.title}”: ${error.message}`);
    }
    await refresh();
  });

  $('open-add').addEventListener('click', openAddDialog);
  $('close-add').addEventListener('click', () => els.dialog.close());
  els.dialog.addEventListener('close', () => {
    // The event arrives asynchronously: the dialog may already have been reopened (“Got it”).
    if (els.dialog.open) return;
    stopScanning();
    cancelSearch(); // stops loading editions or results nobody will see
  });

  $('start-scan').addEventListener('click', startScanning);
  $('stop-scan').addEventListener('click', () => { stopScanning(); setStatus(''); });

  $('photo').addEventListener('change', (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    stopScanning();
    searchFromPhoto(file);
  });

  els.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    stopScanning();
    const form = new FormData(els.searchForm);
    const criteria = {
      artist: String(form.get('artist')),
      title: String(form.get('title')),
      catno: String(form.get('catno')),
    };
    if (Object.values(criteria).some((value) => value.trim())) {
      runSearch('Searching', () => catalog.searchByText(criteria), RESULTS.ALBUMS);
      return;
    }
    const barcode = normalizeBarcode(form.get('barcode'));
    if (barcode) {
      searchByBarcode(barcode);
      return;
    }
    setStatus('Enter a barcode, an artist, a title or a catalogue number.');
  });

  // Results: data-act = own (add to the Collection), wish (add to the Wishlist), pick (open the picker).
  els.candidates.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const index = Number(button.dataset.index);
    const item = state.resultsMode === RESULTS.ALBUMS ? state.albums[index]?.album : state.candidates[index];
    if (!item) return;
    if (button.dataset.act === 'pick') {
      openPicker(item);
      return;
    }
    await addToLibrary(item, button.dataset.act === 'wish' ? STATUS.WANTED : STATUS.OWNED);
    renderCandidateList();
  });

  $('picker-back').addEventListener('click', closePicker);
  els.pickerFormat.addEventListener('change', () => {
    if (!state.picker) return;
    state.picker.filters.format = els.pickerFormat.value;
    renderPicker();
  });
  els.pickerCountry.addEventListener('change', () => {
    if (!state.picker) return;
    state.picker.filters.country = els.pickerCountry.value;
    renderPicker();
  });
  els.pickerText.addEventListener('input', () => {
    if (!state.picker) return;
    state.picker.filters.text = els.pickerText.value;
    renderPicker();
  });
  els.pickerList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-act="own"]');
    const edition = state.picker?.editions[Number(button?.dataset.index)];
    if (!edition) return;
    await addToLibrary(edition, STATUS.OWNED);
    renderPicker();
  });

  $('export').addEventListener('click', () => exportLibrary().catch((error) => toast(error.message)));
  $('import').addEventListener('change', (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (file) importLibrary(file);
  });

  $('open-settings').addEventListener('click', openSettings);
  $('close-settings').addEventListener('click', () => els.settingsDialog.close());
  els.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const token = String(new FormData(els.settingsForm).get('discogsToken'));
    if (!token.trim()) {
      els.tokenState.textContent = 'Paste your token into the field first.';
      return;
    }
    saveDiscogsToken(token);
  });
  $('clear-discogs-token').addEventListener('click', () => {
    if (window.confirm('Delete the Discogs token from this device?')) saveDiscogsToken('');
  });

  // Image load errors do not bubble: listen in the capture phase.
  document.addEventListener('error', handleCoverError, true);
}

/* ---------- Start-up ---------- */

$('version').textContent = `v${APP_VERSION}`;
$('discogs-token-link').href = DISCOGS_TOKEN_PAGE;
bindEvents();
reload().catch((error) => {
  els.library.innerHTML = '';
  toast(`Storage unavailable: ${error.message}`);
});
