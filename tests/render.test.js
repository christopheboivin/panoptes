import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml, candidateHints, recordHints, renderCandidates, renderLibrary, renderAlbums, renderEditions,
  renderFilterOptions, ownedAlbumQuestion, vinylBadge, formatIcon,
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
  const onCd = { record: { format: 'CD' }, level: MATCH.SAME };
  const onLp = { record: { format: '12" Vinyl' }, level: MATCH.PROBABLE };
  assert.deepEqual(recordHints(wanted, { ...none, otherEditions: [onCd] }), ['You own it on CD only']);
  assert.deepEqual(recordHints(wanted, { ...none, otherEditions: [onCd, onLp] }), ['You own it on vinyl']);
});

test('ownedAlbumQuestion lists the owned editions and says when none is a vinyl', () => {
  const cd = { record: { title: 'Kind of Blue', year: '1997', country: 'US', format: 'CD', label: 'Columbia', catno: 'CK 64935' }, level: MATCH.SAME };
  const question = ownedAlbumQuestion({ title: 'Kind of Blue' }, [cd]);
  assert.match(question, /^You already own “Kind of Blue”:\n• 1997 · US · CD \(Columbia CK 64935\)\nIt is not a vinyl \(CD only\)\./);
  assert.match(ownedAlbumQuestion({ title: 'X' }, [cd, cd]), /None of them is a vinyl/);
  assert.doesNotMatch(ownedAlbumQuestion({ title: 'X' }, [{ ...cd, record: { ...cd.record, format: 'Vinyl' } }]), /vinyl \(/);
});

test('vinylBadge: a vinyl edition, or the vinyl editions of an album', () => {
  assert.match(vinylBadge({ format: '12" Vinyl' }), /Vinyl</);
  assert.equal(vinylBadge({ format: 'CD' }), '');
  assert.match(vinylBadge({}, 2), /Vinyl: 2 editions/);
  assert.match(vinylBadge({}, 0), /No vinyl in these results/);
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

test('each result shows its own source, as results can come from several', () => {
  const album = { title: 'Kind of Blue', artist: 'Miles Davis', coverUrls: [] };
  const albums = renderAlbums([
    { album, editionCount: 1, relations: none, canPick: true, sourceName: 'MusicBrainz' },
    { album, editionCount: 1, relations: none, canPick: true, sourceName: 'Discogs' },
  ]);
  assert.match(albums, /Source: MusicBrainz[\s\S]*Source: Discogs/);
  assert.match(renderCandidates([{ candidate: album, relations: none, sourceName: '<b>' }]), /Source: &lt;b&gt;/);
  assert.doesNotMatch(renderCandidates([{ candidate: album, relations: none }]), /Source:/);
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


test('formatIcon for Vinyl, CD, Cassette and Digital only', () => {
  assert.match(formatIcon('2×Vinyl, LP, Album'), /aria-label="Vinyl"/);
  assert.match(formatIcon('CD'), /aria-label="CD"/);
  assert.match(formatIcon('Cassette'), /aria-label="Cassette"/);
  assert.match(formatIcon('Digital Media'), /aria-label="Digital"/);
  assert.equal(formatIcon(''), '');
  assert.equal(formatIcon('DVD'), '');
});

test('a Collection copy without a format is flagged, a Wishlist album is not', () => {
  const owned = { id: '1', status: STATUS.OWNED, title: 'A', artist: 'X', format: '', coverUrls: [] };
  const wanted = { ...owned, id: '2', status: STATUS.WANTED };
  assert.match(renderLibrary([owned], { status: STATUS.OWNED, filter: '' }), /Format unknown/);
  assert.doesNotMatch(renderLibrary([wanted], { status: STATUS.WANTED, filter: '' }), /Format unknown/);
});
