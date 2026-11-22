import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml, candidateHints, recordHints, renderCandidates, renderLibrary, renderAlbums, renderEditions,
  renderFilterOptions, renderOcrSuggestions,
} from '../js/ui/render.js';
import { MATCH } from '../js/models/match.js';
import { STATUS } from '../js/models/record.js';

const same = { record: {}, level: MATCH.SAME };
const probable = { record: {}, level: MATCH.PROBABLE };
const none = { copies: [], otherEditions: [], wanted: [] };

test('escapeHtml escapes markup characters', () => {
  assert.equal(escapeHtml('<b a="1">Tom & Jerry\'s</b>'), '&lt;b a=&quot;1&quot;&gt;Tom &amp; Jerry&#39;s&lt;/b&gt;');
  assert.equal(escapeHtml(null), '');
});

test('candidateHints describe copies, other editions and the wishlist', () => {
  assert.deepEqual(candidateHints(none), []);
  assert.deepEqual(candidateHints({ ...none, copies: [same, same] }), ['In your collection (2 copies)']);
  assert.deepEqual(candidateHints({ ...none, copies: [probable] }), ['Maybe already in your collection (1 copy, same catalogue number)']);
  assert.deepEqual(candidateHints({ ...none, otherEditions: [same] }), ['You own another edition of this album']);
  assert.deepEqual(candidateHints({ ...none, otherEditions: [probable] }), ['You may own another edition of this album']);
  assert.deepEqual(candidateHints({ ...none, wanted: [same] }), ['On your wishlist']);
});

test('recordHints for a Collection copy and for a Wishlist album', () => {
  const owned = { status: STATUS.OWNED };
  const wanted = { status: STATUS.WANTED };
  assert.deepEqual(recordHints(owned, { ...none, copies: [same] }), ['2 copies of this edition']);
  assert.deepEqual(recordHints(owned, { ...none, otherEditions: [same, same] }), ['Also 2 other editions of this album']);
  assert.deepEqual(recordHints(wanted, { ...none, otherEditions: [same] }), ['You own an edition of this album']);
  assert.deepEqual(recordHints(wanted, { ...none, otherEditions: [probable] }), ['You may own an edition of this album']);
  assert.deepEqual(recordHints(wanted, none), []);
});

test('renderCandidates offers another copy, and no wishlist button for an album already wanted', () => {
  const candidate = { title: 'Kind of Blue', artist: 'Miles Davis', coverUrls: [] };
  const fresh = renderCandidates([{ candidate, relations: none }]);
  assert.match(fresh, /\+ Collection/);
  assert.match(fresh, /\+ Wishlist/);

  const known = renderCandidates([{ candidate, relations: { ...none, copies: [same], wanted: [same] } }]);
  assert.match(known, /\+ Another copy/);
  assert.doesNotMatch(known, /\+ Wishlist/);
  assert.match(known, /On your wishlist/);
});

test('renderLibrary escapes record data and shows hints', () => {
  const record = { id: 'a', status: STATUS.OWNED, title: '<script>', artist: 'X', coverUrls: [] };
  const html = renderLibrary([record], { status: STATUS.OWNED, filter: '' }, new Map([['a', { ...none, copies: [same] }]]));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /2 copies of this edition/);
});

test('renderAlbums: “I own it…” when the editions can be listed, direct add otherwise', () => {
  const album = { title: 'Kind of Blue', artist: 'Miles Davis', year: '1959', format: 'CD', coverUrls: [] };
  const pickable = renderAlbums([{ album, editionCount: 12, relations: { ...none, otherEditions: [same] }, canPick: true }]);
  assert.match(pickable, /data-act="pick"[^>]*>I own it…/);
  assert.match(pickable, /12 editions in these results/);
  assert.match(pickable, /In your collection \(1 copy\)/);
  const single = renderAlbums([{ album, editionCount: 1, relations: none, canPick: false }]);
  assert.match(single, /data-act="own"[^>]*>\+ Collection/);
  assert.match(single, /1959 · CD/);
});

test('renderEditions: compact rows keeping the index in the full list', () => {
  const edition = { year: '1959', country: 'US', format: '12" Vinyl', label: 'Columbia', catno: 'CL 1355', barcode: '', coverUrls: [] };
  const html = renderEditions([{ edition, index: 7, relations: none }]);
  assert.match(html, /1959 · US · 12&quot; Vinyl/);
  assert.match(html, /Columbia – CL 1355/);
  assert.match(html, /data-index="7"[^>]*>This one/);
  assert.doesNotMatch(html, /Barcode/);
  assert.match(renderEditions([{ edition, index: 0, relations: { ...none, copies: [same] } }]), />Another copy</);
});

test('renderFilterOptions keeps the selected value', () => {
  const html = renderFilterOptions('All formats', [{ value: 'Vinyl', count: 3 }, { value: 'CD', count: 1 }], 'CD');
  assert.match(html, /<option value="">All formats<\/option>/);
  assert.match(html, /<option value="CD" selected>CD \(1\)<\/option>/);
});

test('renderOcrSuggestions: one button per catalogue number, and the barcode', () => {
  const html = renderOcrSuggestions({ catalogNumbers: ['PGLP 21', 'PGLP21'], barcode: '0724384960650' });
  assert.match(html, /data-catno="PGLP 21">PGLP 21</);
  assert.match(html, /data-catno="PGLP21">/);
  assert.match(html, /data-barcode="0724384960650">Barcode 0724384960650</);
  assert.equal(renderOcrSuggestions({ catalogNumbers: ['<b>'], barcode: '' }).includes('<b>'), false);
});
