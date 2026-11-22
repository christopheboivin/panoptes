/**
 * Generation of the displayed HTML (pure functions: data -> string).
 * All external data goes through escapeHtml().
 *
 * “Relations” (copies, other editions, wishlist) come from
 * models/match.js findRelations(); they are only shown as hints.
 */

import { STATUS } from '../models/record.js';
import { isCertain } from '../models/match.js';
import { groupByArtist } from '../models/artists.js';
import { formatFamily } from '../models/editions.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

const NO_RELATIONS = Object.freeze({ copies: [], otherEditions: [], wanted: [] });

function count(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Hints for a search result: what the library already holds for it. */
export function candidateHints({ copies, otherEditions, wanted } = NO_RELATIONS) {
  const hints = [];
  if (copies.length > 0) {
    const copiesText = count(copies.length, 'copy', 'copies');
    hints.push(isCertain(copies)
      ? `In your collection (${copiesText})`
      : `Maybe already in your collection (${copiesText}, same catalogue number)`);
  }
  if (otherEditions.length > 0) {
    hints.push(isCertain(otherEditions)
      ? `You own ${otherEditions.length === 1 ? 'another edition' : `${otherEditions.length} other editions`} of this album`
      : 'You may own another edition of this album');
  }
  if (wanted.length > 0) {
    hints.push(isCertain(wanted) ? 'On your wishlist' : 'Maybe on your wishlist');
  }
  return hints;
}

/** Hints for an album in the search results: any edition owned, on the wishlist. */
export function albumHints({ copies, otherEditions, wanted } = NO_RELATIONS) {
  const hints = [];
  const owned = [...copies, ...otherEditions];
  if (owned.length > 0) {
    hints.push(isCertain(owned)
      ? `In your collection (${count(owned.length, 'copy', 'copies')})`
      : 'Maybe in your collection');
  }
  if (wanted.length > 0) {
    hints.push(isCertain(wanted) ? 'On your wishlist' : 'Maybe on your wishlist');
  }
  return hints;
}

const FAMILY_NAMES = { Vinyl: 'vinyl', CD: 'CD', Cassette: 'cassette', Digital: 'digital' };

/**
 * Formats of the owned records of matches, in words: 'on vinyl', 'on CD only',
 * 'on CD and cassette only', or '' when their formats are unknown.
 */
export function ownedFormats(matches) {
  const families = new Set(matches.map(({ record }) => formatFamily(record.format)));
  if (families.has('Vinyl')) return 'on vinyl';
  const known = [...families].map((family) => FAMILY_NAMES[family]).filter(Boolean);
  return known.length > 0 ? `on ${known.join(' and ')} only` : '';
}

/**
 * Plain-text question (for confirm()) before adding to the Wishlist an album
 * that the Collection already holds. owned: copies and otherEditions matches.
 */
export function ownedAlbumQuestion(item, owned) {
  const editions = owned.slice(0, 3).map(({ record }) => {
    const catalog = [record.label, record.catno].filter(Boolean).join(' ');
    const main = [record.year, record.country, record.format].filter(Boolean).join(' · ') || 'Unknown edition';
    return `• ${main}${catalog ? ` (${catalog})` : ''}`;
  });
  if (owned.length > 3) editions.push(`• and ${owned.length - 3} more`);
  const opening = isCertain(owned)
    ? `You already own “${item.title}”:`
    : `Your collection contains “${owned[0].record.title}”${owned[0].record.artist ? ` by ${owned[0].record.artist}` : ''}, which looks like the same album:`;
  const formats = ownedFormats(owned);
  const vinylNote = formats && formats !== 'on vinyl'
    ? `${owned.length === 1 ? 'It is not a vinyl' : 'None of them is a vinyl'} (${formats.replace(/^on /, '')}).`
    : '';
  return [opening, ...editions, vinylNote, 'Add it to your wishlist anyway?'].filter(Boolean).join('\n');
}

/** Hints for a card of the library. */
export function recordHints(record, { copies, otherEditions } = NO_RELATIONS) {
  if (record.status === STATUS.WANTED) {
    const owned = [...copies, ...otherEditions];
    if (owned.length === 0) return [];
    const formats = ownedFormats(owned);
    if (!formats) return [isCertain(owned) ? 'You own an edition of this album' : 'You may own an edition of this album'];
    return [`${isCertain(owned) ? 'You own it' : 'You may own it'} ${formats}`];
  }
  const hints = [];
  if (copies.length > 0) {
    hints.push(isCertain(copies)
      ? `${copies.length + 1} copies of this edition`
      : 'Maybe the same edition as another record');
  }
  if (otherEditions.length > 0) {
    hints.push(isCertain(otherEditions)
      ? `Also ${count(otherEditions.length, 'other edition', 'other editions')} of this album`
      : 'Maybe another edition of an album you own');
  }
  return hints;
}

function hintLines(hints) {
  return hints.map((hint) => `<p class="card__hint">${escapeHtml(hint)}</p>`).join('');
}

/** Cover with fallback URLs (handled by handleCoverError in main.js). */
function cover(coverUrls = [], extraClass = '') {
  const [first, ...fallbacks] = coverUrls;
  const className = `cover${extraClass ? ` ${extraClass}` : ''}`;
  if (!first) return `<div class="${className} cover--empty" aria-hidden="true"></div>`;
  return `<img class="${className}" src="${escapeHtml(first)}" data-fallbacks="${escapeHtml(fallbacks.join(' '))}"
    alt="" loading="lazy" width="250" height="250">`;
}

function metaLine(item) {
  const catalog = [item.label, item.catno].filter(Boolean).join(' – ');
  return [item.year, item.format, item.country, catalog].filter(Boolean).map(escapeHtml).join(' · ');
}

function recordCard(record, relations) {
  const isWanted = record.status === STATUS.WANTED;
  // A Wishlist album only holds the format wanted (see models/record.js toAlbum).
  const meta = isWanted
    ? (record.format ? escapeHtml(`Wanted on ${FAMILY_NAMES[formatFamily(record.format)] ?? record.format}`) : '')
    : metaLine(record);
  return `<li class="card">
    ${cover(record.coverUrls)}
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(record.title)}</h3>
      <p class="card__artist">${escapeHtml(record.artist)}</p>
      ${meta ? `<p class="card__meta">${meta}</p>` : ''}
      ${hintLines(recordHints(record, relations))}
      <div class="card__actions">
        ${isWanted ? `<button type="button" class="btn btn--small" data-action="acquire" data-id="${escapeHtml(record.id)}">Got it</button>` : ''}
        <button type="button" class="btn btn--small btn--ghost" data-action="remove" data-id="${escapeHtml(record.id)}">Remove</button>
      </div>
    </div>
  </li>`;
}

/**
 * @param {object[]} records - records to display
 * @param {{ status: string, filter: string }} view
 * @param {Map<string, object>} [relationsById] - findRelations() result per record id
 * @param {Set<string>} [openArtists] - keys of the unfolded artist groups (folded by default)
 */
export function renderLibrary(records, { status, filter }, relationsById = new Map(), openArtists = new Set()) {
  if (records.length === 0) {
    const empty = filter
      ? 'No record matches your search.'
      : status === STATUS.WANTED
        ? 'Your wishlist is empty. Add an album with the “Add” button.'
        : 'Your collection is empty. Add your first record with the “Add” button.';
    return `<p class="empty">${empty}</p>`;
  }
  // While filtering, every group shown is unfolded.
  const isOpen = (key) => Boolean(filter) || openArtists.has(key);
  return groupByArtist(records).map(({ key, artist, records: own }) => {
    const previews = [...own.filter((r) => r.coverUrls?.length), ...own.filter((r) => !r.coverUrls?.length)].slice(0, 2);
    return `<details class="artist" data-artist="${escapeHtml(key)}"${isOpen(key) ? ' open' : ''}>
    <summary class="artist__head">
      <span class="artist__previews">${previews.map((r) => cover(r.coverUrls, 'cover--thumb')).join('')}</span>
      <span class="artist__text">
        <span class="artist__name">${escapeHtml(artist)}</span>
        <span class="artist__count">${count(own.length, 'record', 'records')}</span>
      </span>
    </summary>
    <ul class="grid">${own.map((record) => recordCard(record, relationsById.get(record.id))).join('')}</ul>
  </details>`;
  }).join('');
}

/**
 * Buttons carry data-act (own: add to the Collection; wish: add the album to
 * the Wishlist; pick: open the edition picker) and data-index (position in
 * the list given here).
 */

function button(act, index, label, ghost = false) {
  return `<button type="button" class="btn btn--small${ghost ? ' btn--ghost' : ''}" data-act="${act}" data-index="${index}">${label}</button>`;
}

/**
 * Vinyl badge of a search result. vinylCount: vinyl editions of the album in
 * the results, or null for a single edition (badge only when it is a vinyl).
 */
export function vinylBadge(item, vinylCount = null) {
  if (vinylCount === null) {
    return formatFamily(item.format) === 'Vinyl' ? '<p class="badge badge--vinyl">Vinyl</p>' : '';
  }
  return vinylCount > 0
    ? `<p class="badge badge--vinyl">Vinyl: ${count(vinylCount, 'edition', 'editions')}</p>`
    : '<p class="badge">No vinyl in these results</p>';
}

function wishButton(relations, index) {
  return isCertain(relations.wanted) ? '' : button('wish', index, '+ Wishlist', true);
}

/**
 * Search results shown edition by edition (barcode search: the code
 * identifies the edition).
 * @param {Array<{candidate: object, relations: object, canPick?: boolean}>} items
 *   relations: findRelations() result; canPick: its other editions can be listed
 * @param {string} [sourceName] - name of the source that provided the results
 */
export function renderCandidates(items, sourceName = '') {
  return items.map(({ candidate, relations = NO_RELATIONS, canPick = false }, index) => {
    const ownedLabel = isCertain(relations.copies) ? '+ Another copy' : '+ Collection';
    return `<li class="candidate">
    ${cover(candidate.coverUrls)}
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(candidate.title)}</h3>
      <p class="card__artist">${escapeHtml(candidate.artist)}</p>
      <p class="card__meta">${metaLine(candidate)}</p>
      ${vinylBadge(candidate)}
      ${sourceName ? `<p class="card__source">Source: ${escapeHtml(sourceName)}</p>` : ''}
      ${hintLines(candidateHints(relations))}
      <div class="card__actions">
        ${button('own', index, ownedLabel)}
        ${wishButton(relations, index)}
        ${canPick ? button('pick', index, 'Other editions…', true) : ''}
      </div>
    </div>
  </li>`;
  }).join('');
}

/**
 * Search results grouped by album (text search).
 * @param {Array<{album: object, editionCount: number, vinylCount: number, relations: object, canPick: boolean}>} items
 *   album: one of its editions; editionCount: editions of it in the results, vinylCount: vinyl ones;
 *   canPick: its editions can be listed (otherwise the single edition is added directly)
 * @param {string} [sourceName]
 */
export function renderAlbums(items, sourceName = '') {
  return items.map(({ album, editionCount, vinylCount = 0, relations = NO_RELATIONS, canPick }, index) => {
    const detail = canPick
      ? escapeHtml(`${count(editionCount, 'edition', 'editions')} in these results`)
      : metaLine(album);
    const ownButton = canPick
      ? button('pick', index, 'I own it…')
      : button('own', index, isCertain(relations.copies) ? '+ Another copy' : '+ Collection');
    return `<li class="candidate">
    ${cover(album.coverUrls)}
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(album.title)}</h3>
      <p class="card__artist">${escapeHtml(album.artist)}</p>
      ${detail ? `<p class="card__meta">${detail}</p>` : ''}
      ${canPick ? vinylBadge(album, vinylCount) : vinylBadge(album)}
      ${sourceName ? `<p class="card__source">Source: ${escapeHtml(sourceName)}</p>` : ''}
      ${hintLines(canPick ? albumHints(relations) : candidateHints(relations))}
      <div class="card__actions">
        ${ownButton}
        ${wishButton(relations, index)}
      </div>
    </div>
  </li>`;
  }).join('');
}

/**
 * Rows of the edition picker: compact, for a phone screen.
 * @param {Array<{edition: object, index: number, relations: object}>} items
 *   index: position of the edition in the picker's full (unfiltered) list
 */
export function renderEditions(items) {
  return items.map(({ edition, index, relations = NO_RELATIONS }) => {
    const main = [edition.year, edition.country, edition.format].filter(Boolean).map(escapeHtml).join(' · ');
    const catalog = [edition.label, edition.catno].filter(Boolean).map(escapeHtml).join(' – ');
    const hints = relations.copies.length > 0
      ? [isCertain(relations.copies) ? `In your collection (${count(relations.copies.length, 'copy', 'copies')})` : 'Maybe in your collection']
      : [];
    return `<li class="edition">
    ${cover(edition.coverUrls)}
    <div class="edition__body">
      <p class="edition__main">${main || 'Unknown edition'}</p>
      ${catalog ? `<p class="edition__sub">${catalog}</p>` : ''}
      ${edition.barcode ? `<p class="edition__sub">Barcode ${escapeHtml(edition.barcode)}</p>` : ''}
      ${hintLines(hints)}
    </div>
    <button type="button" class="btn btn--small" data-act="own" data-index="${index}">${isCertain(relations.copies) ? 'Another copy' : 'This one'}</button>
  </li>`;
  }).join('');
}

/** <option>s of a picker filter: “All …” then each value with its count. */
export function renderFilterOptions(allLabel, options, selected = '') {
  const all = `<option value="">${escapeHtml(allLabel)}</option>`;
  return all + options.map(({ value, count: n }) => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)} (${n})</option>`).join('');
}
