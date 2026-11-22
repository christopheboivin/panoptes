/**
 * Point d'entrée : état de l'écran et liaison des événements.
 * La logique métier vit dans storage/, providers/, identify/ et scanner/.
 */

import { APP_VERSION, DISCOGS_TOKEN_PAGE } from './config.js';
import * as db from './storage/db.js';
import { createLibrary, STATUS } from './storage/library.js';
import { createSettings } from './storage/settings.js';
import { sameRelease } from './models/record.js';
import { provider as musicbrainz } from './providers/musicbrainz.js';
import { createDiscogsProvider } from './providers/discogs.js';
import { createCatalog } from './providers/catalog.js';
import { isValidBarcode, normalizeBarcode } from './models/barcode.js';
import { identifyImage, hasImageIdentifiers } from './identify/index.js';
import { startLiveScan } from './scanner/camera.js';
import { readBarcodeFromImage } from './scanner/barcode-engine.js';
import { renderLibrary, renderCandidates } from './ui/render.js';

const library = createLibrary(db);
const settings = createSettings();
// Ordre d'interrogation : MusicBrainz d'abord, Discogs si MusicBrainz ne trouve rien.
const catalog = createCatalog([
  musicbrainz,
  createDiscogsProvider({ getToken: settings.getDiscogsToken }),
]);

const state = {
  records: [],
  status: STATUS.OWNED,
  filter: '',
  candidates: [],
  candidatesSource: '',
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
};

/* ---------- Affichage ---------- */

function matchesFilter(record, filter) {
  if (!filter) return true;
  const haystack = [record.title, record.artist, record.label, record.catno, record.barcode].join(' ').toLowerCase();
  return haystack.includes(filter);
}

function render() {
  const visible = state.records
    .filter((r) => r.status === state.status && matchesFilter(r, state.filter))
    .sort((a, b) => a.artist.localeCompare(b.artist, 'fr') || a.title.localeCompare(b.title, 'fr'));
  els.library.innerHTML = renderLibrary(visible, state);

  for (const status of Object.values(STATUS)) {
    $(`count-${status}`).textContent = state.records.filter((r) => r.status === status).length;
  }
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.setAttribute('aria-pressed', String(tab.dataset.status === state.status));
  });
}

function renderCandidateList() {
  const items = state.candidates.map((candidate) => ({
    candidate,
    existing: state.records.find((record) => sameRelease(record, candidate)) ?? null,
  }));
  els.candidates.innerHTML = renderCandidates(items, state.candidatesSource);
}

async function reload() {
  state.records = await library.list();
  render();
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

/** Remplace une pochette introuvable par l'URL de secours suivante. */
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

/* ---------- Recherche et identification ---------- */

/**
 * Lance une recherche et affiche ses résultats.
 * search() renvoie { candidates, providerName?, skipped?, detail? } ; runSearch renvoie
 * ce résultat (ou null en cas d'erreur, déjà signalée à l'utilisateur).
 */
async function runSearch(label, search) {
  state.candidates = [];
  state.candidatesSource = '';
  renderCandidateList();
  setStatus(`${label}…`);
  try {
    const result = await search();
    state.candidates = result.candidates;
    state.candidatesSource = result.providerName ?? '';
    renderCandidateList();
    const count = result.candidates.length;
    const where = result.providerName ? ` sur ${result.providerName}` : '';
    const summary = count === 0 ? 'Aucun disque trouvé.' : `${count} résultat${count > 1 ? 's' : ''}${where}.`;
    setStatus([result.detail, summary, discogsHint(result)].filter(Boolean).join(' '));
    return result;
  } catch (error) {
    setStatus(error.message, 'warn');
    return null;
  }
}

/** Suggère de configurer Discogs quand il n'a pas pu être interrogé faute de jeton. */
function discogsHint(result) {
  return result.candidates.length === 0 && result.skipped?.includes('Discogs')
    ? 'Astuce : ajoute un jeton Discogs dans les Réglages pour chercher aussi sur Discogs, bien plus complet pour les vinyles.'
    : '';
}

/**
 * Étape de confirmation : le code lu est placé dans le champ « Code-barres »
 * et rien n'est envoyé à MusicBrainz tant que l'utilisateur ne valide pas.
 */
function proposeBarcode(code) {
  const digits = normalizeBarcode(code);
  state.candidates = [];
  renderCandidateList();
  els.searchForm.elements.barcode.value = digits;
  if (isValidBarcode(digits)) {
    setStatus(`Code-barres lu : ${digits} (clé de contrôle correcte). Compare-le avec celui du disque, puis appuie sur « Rechercher ».`, 'ok');
  } else {
    setStatus(`Code lu : ${digits || code}, mais sa clé de contrôle est incorrecte. Rescanne ou corrige-le avant de rechercher.`, 'warn');
  }
  els.searchForm.querySelector('button[type="submit"]').focus();
}

async function searchFromPhoto(file) {
  setStatus('Lecture du code-barres sur la photo…');
  try {
    const code = await readBarcodeFromImage(file);
    if (code) {
      proposeBarcode(code);
    } else if (hasImageIdentifiers()) {
      await runSearch('Analyse de la photo', () => identifyImage(file));
    } else {
      setStatus('Aucun code-barres lisible sur la photo. Reprends-la plus nette, ou saisis le code à la main.', 'warn');
    }
  } catch (error) {
    setStatus(error.message, 'warn');
  }
}

async function searchByBarcode(code) {
  const result = await runSearch(`Recherche du code-barres ${code}`, async () => ({
    ...(await catalog.searchByBarcode(code)),
    detail: `Code-barres ${code}.`,
  }));
  if (result && result.candidates.length === 0) {
    const where = result.skipped.includes('Discogs') ? 'pas sur MusicBrainz' : 'ni sur MusicBrainz ni sur Discogs';
    setStatus([
      `Le code-barres ${code} n'est référencé ${where}.`,
      'Cherche par artiste et titre, ou par numéro de catalogue : ce code sera enregistré avec le disque que tu choisiras.',
      discogsHint(result),
    ].filter(Boolean).join(' '), 'warn');
    els.searchForm.elements.artist.focus();
  }
}

function stopScanning() {
  state.stopScan?.();
  state.stopScan = null;
  els.scanner.hidden = true;
}

async function startScanning() {
  stopScanning();
  els.scanner.hidden = false;
  setStatus('Vise le code-barres du disque.');
  try {
    state.stopScan = await startLiveScan(els.video, (code) => {
      state.stopScan = null;
      els.scanner.hidden = true;
      navigator.vibrate?.(80);
      proposeBarcode(code);
    });
  } catch (error) {
    els.scanner.hidden = true;
    setStatus(error.message);
  }
}

function openAddDialog() {
  state.candidates = [];
  renderCandidateList();
  setStatus('');
  els.searchForm.reset();
  els.dialog.showModal();
}

/* ---------- Réglages ---------- */

function renderTokenState() {
  els.tokenState.textContent = settings.getDiscogsToken()
    ? 'Un jeton est enregistré sur cet appareil.'
    : 'Aucun jeton enregistré : seul MusicBrainz est interrogé.';
}

function openSettings() {
  els.settingsForm.reset(); // le jeton enregistré n'est jamais réaffiché
  renderTokenState();
  els.settingsDialog.showModal();
}

function saveDiscogsToken(token) {
  try {
    settings.setDiscogsToken(token);
    renderTokenState();
    els.settingsForm.reset();
    toast(token.trim() ? 'Jeton Discogs enregistré.' : 'Jeton Discogs effacé.');
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
  toast(`${data.records.length} disque(s) exporté(s).`);
}

async function importLibrary(file) {
  try {
    const data = JSON.parse(await file.text());
    const { imported, rejected } = await library.importData(data);
    await reload();
    toast(`${imported} disque(s) importé(s)${rejected ? `, ${rejected} ignoré(s) car invalides` : ''}.`);
  } catch (error) {
    toast(error instanceof SyntaxError ? 'Fichier illisible : JSON invalide.' : error.message);
  }
}

/* ---------- Événements ---------- */

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
      await library.setStatus(record, STATUS.OWNED);
      toast(`« ${record.title} » ajouté à ta collection.`);
    } else if (button.dataset.action === 'remove') {
      if (!window.confirm(`Retirer « ${record.title} » ?`)) return;
      await library.remove(record.id);
    }
    await reload();
  });

  $('open-add').addEventListener('click', openAddDialog);
  $('close-add').addEventListener('click', () => els.dialog.close());
  els.dialog.addEventListener('close', stopScanning);

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
      runSearch('Recherche', () => catalog.searchByText(criteria));
      return;
    }
    const barcode = normalizeBarcode(form.get('barcode'));
    if (barcode) {
      searchByBarcode(barcode);
      return;
    }
    setStatus('Saisis un code-barres, un artiste, un titre ou un numéro de catalogue.');
  });

  els.candidates.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-add]');
    if (!button) return;
    const candidate = state.candidates[Number(button.dataset.index)];
    // Si la source ne connaît pas le code-barres de l'édition, on garde celui du disque en main.
    const scanned = normalizeBarcode(els.searchForm.elements.barcode.value);
    const data = candidate.barcode || !scanned ? candidate : { ...candidate, barcode: scanned };
    const record = await library.add(data, button.dataset.add);
    await reload();
    renderCandidateList();
    toast(`« ${record.title} » ajouté ${record.status === STATUS.OWNED ? 'à ta collection' : 'à tes envies'}.`);
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
      els.tokenState.textContent = 'Colle d\'abord ton jeton dans le champ.';
      return;
    }
    saveDiscogsToken(token);
  });
  $('clear-discogs-token').addEventListener('click', () => {
    if (window.confirm('Effacer le jeton Discogs de cet appareil ?')) saveDiscogsToken('');
  });

  // Les erreurs de chargement d'image ne remontent pas : écoute en phase de capture.
  document.addEventListener('error', handleCoverError, true);
}

/* ---------- Démarrage ---------- */

$('version').textContent = `v${APP_VERSION}`;
$('discogs-token-link').href = DISCOGS_TOKEN_PAGE;
bindEvents();
reload().catch((error) => {
  els.library.innerHTML = '';
  toast(`Stockage indisponible : ${error.message}`);
});
