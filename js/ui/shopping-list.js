/**
 * Shopping list: a standalone HTML page listing the Wishlist albums by
 * artist, each with search links to the shops in their order of preference.
 *
 * renderShoppingList(records, { shops, relationsById, date }) -> HTML document (string)
 *   records: Wishlist records; shops: see SHOPS in config.js;
 *   relationsById: findRelations() result per record id (owned editions noted).
 *
 * Pure function. The page has inline styles and no script; all record data
 * goes through escapeHtml(). Links open the shops only when tapped.
 */

import { escapeHtml, recordHints } from './render.js';
import { groupByArtist } from '../models/artists.js';
import { shopLinks } from '../models/shops.js';
import { formatFamily } from '../models/editions.js';

const STYLE = `
  :root { color-scheme: light dark; --ink: light-dark(#18181a, #ececec); --muted: light-dark(#66666c, #9a9aa0);
    --line: light-dark(#e2e0da, #2c2c2c); --accent: light-dark(#c2410c, #fb923c); --bg: light-dark(#f6f5f2, #121212); }
  * { box-sizing: border-box; }
  body { margin: 0 auto; max-width: 40rem; padding: 16px; font: 16px/1.4 system-ui, sans-serif;
    background: var(--bg); color: var(--ink); }
  h1 { margin: 0; font-size: 22px; }
  .date { margin: 2px 0 16px; color: var(--muted); font-size: 14px; }
  h2 { margin: 20px 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--line); font-size: 17px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 8px 0; }
  .title { font-weight: 600; }
  .meta { color: var(--muted); font-size: 14px; }
  .owned { color: var(--accent); font-size: 14px; font-weight: 600; }
  .shops { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .shops a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border: 1px solid var(--accent);
    border-radius: 10px; color: var(--accent); font-weight: 600; text-decoration: none; }
`;

const FORMAT_NAMES = { Vinyl: 'vinyl', CD: 'CD', Cassette: 'cassette', Digital: 'digital' };

function albumItem(record, shops, relations) {
  const wanted = record.format ? `Wanted on ${FORMAT_NAMES[formatFamily(record.format)] ?? record.format}` : '';
  const links = shopLinks(record, shops)
    .map(({ name, href }) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`)
    .join('');
  const hints = recordHints(record, relations).map((hint) => `<div class="owned">${escapeHtml(hint)}</div>`).join('');
  return `<li>
      <div class="title">${escapeHtml(record.title)}</div>
      ${wanted ? `<div class="meta">${escapeHtml(wanted)}</div>` : ''}
      ${hints}
      <div class="shops">${links}</div>
    </li>`;
}

export function renderShoppingList(records, { shops, relationsById = new Map(), date = new Date() }) {
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const groups = groupByArtist(records).map(({ artist, records: albums }) => `
  <h2>${escapeHtml(artist || 'Unknown artist')}</h2>
  <ul>
    ${albums.map((record) => albumItem(record, shops, relationsById.get(record.id))).join('')}
  </ul>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Wishlist – Panoptes</title>
<style>${STYLE}</style>
</head>
<body>
  <h1>Wishlist</h1>
  <p class="date">${escapeHtml(`${records.length} album${records.length === 1 ? '' : 's'} · ${day}`)}</p>
  ${groups}
</body>
</html>
`;
}
