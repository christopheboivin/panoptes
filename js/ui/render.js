/**
 * Génération du HTML affiché (fonctions pures : données -> chaîne).
 * Toute donnée externe passe par escapeHtml().
 */

import { STATUS } from '../models/record.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** Pochette avec URLs de secours (gérées par handleCoverError dans main.js). */
function cover(coverUrls = []) {
  const [first, ...fallbacks] = coverUrls;
  if (!first) return '<div class="cover cover--empty" aria-hidden="true"></div>';
  return `<img class="cover" src="${escapeHtml(first)}" data-fallbacks="${escapeHtml(fallbacks.join(' '))}"
    alt="" loading="lazy" width="250" height="250">`;
}

function metaLine(item) {
  const catalog = [item.label, item.catno].filter(Boolean).join(' – ');
  return [item.year, item.format, item.country, catalog].filter(Boolean).map(escapeHtml).join(' · ');
}

function recordCard(record) {
  const isWanted = record.status === STATUS.WANTED;
  return `<li class="card">
    ${cover(record.coverUrls)}
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(record.title)}</h3>
      <p class="card__artist">${escapeHtml(record.artist)}</p>
      <p class="card__meta">${metaLine(record)}</p>
      <div class="card__actions">
        ${isWanted ? `<button type="button" class="btn btn--small" data-action="acquire" data-id="${escapeHtml(record.id)}">Je l'ai</button>` : ''}
        <button type="button" class="btn btn--small btn--ghost" data-action="remove" data-id="${escapeHtml(record.id)}">Retirer</button>
      </div>
    </div>
  </li>`;
}

export function renderLibrary(records, { status, filter }) {
  if (records.length === 0) {
    const empty = filter
      ? 'Aucun disque ne correspond à ta recherche.'
      : status === STATUS.WANTED
        ? 'Ta liste d\'envies est vide. Ajoute un disque avec le bouton « Ajouter ».'
        : 'Ta collection est vide. Ajoute ton premier disque avec le bouton « Ajouter ».';
    return `<p class="empty">${empty}</p>`;
  }
  return `<ul class="grid">${records.map(recordCard).join('')}</ul>`;
}

const STATUS_LABEL = { [STATUS.OWNED]: 'dans ta collection', [STATUS.WANTED]: 'dans tes envies' };

/**
 * @param {Array<{candidate: object, existing: object|null}>} items
 * @param {string} [sourceName] - nom de la source qui a fourni les résultats
 */
export function renderCandidates(items, sourceName = '') {
  return items.map(({ candidate, existing }, index) => `<li class="candidate">
    ${cover(candidate.coverUrls)}
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(candidate.title)}</h3>
      <p class="card__artist">${escapeHtml(candidate.artist)}</p>
      <p class="card__meta">${metaLine(candidate)}</p>
      ${sourceName ? `<p class="card__source">Source : ${escapeHtml(sourceName)}</p>` : ''}
      ${existing
        ? `<p class="badge">Déjà ${STATUS_LABEL[existing.status]}</p>`
        : `<div class="card__actions">
            <button type="button" class="btn btn--small" data-add="${STATUS.OWNED}" data-index="${index}">+ Collection</button>
            <button type="button" class="btn btn--small btn--ghost" data-add="${STATUS.WANTED}" data-index="${index}">+ Envies</button>
          </div>`}
    </div>
  </li>`).join('');
}
