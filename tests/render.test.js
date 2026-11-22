import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml, candidateHints, recordHints, renderCandidates, renderLibrary,
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
