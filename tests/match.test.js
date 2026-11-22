import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH, normalizeText, normalizeCatno, editionMatch, albumMatch, findRelations, isCertain,
} from '../js/models/match.js';
import { STATUS } from '../js/models/record.js';

const mb = (id, groupId, extra = {}) => ({
  title: 'Kind of Blue', artist: 'Miles Davis', source: { provider: 'musicbrainz', id, groupId }, ...extra,
});
const discogs = (id, groupId, extra = {}) => ({
  title: 'Kind Of Blue', artist: 'Miles Davis', source: { provider: 'discogs', id, groupId }, ...extra,
});

test('normalizeText ignores case, accents, punctuation and “&”', () => {
  assert.equal(normalizeText('  Björk — Début! '), 'bjork debut');
  assert.equal(normalizeText('Simon & Garfunkel'), normalizeText('Simon and Garfunkel'));
  assert.equal(normalizeText(undefined), '');
});

test('normalizeCatno ignores spaces, dashes, dots and case', () => {
  assert.equal(normalizeCatno('cl 1355'), 'CL1355');
  assert.equal(normalizeCatno('CL-1355'), 'CL1355');
  assert.equal(normalizeCatno('P.G. LP 21'), 'PGLP21');
});

test('editionMatch: same source identifier', () => {
  assert.equal(editionMatch(mb('r1', 'g1'), mb('r1', 'g1')), MATCH.SAME);
  assert.equal(editionMatch(mb('r1', 'g1'), mb('r2', 'g1')), MATCH.NONE);
  // Same id from two different sources means nothing.
  assert.equal(editionMatch(mb('1', ''), discogs('1', '')), MATCH.NONE);
});

test('editionMatch: same barcode across sources, UPC-A and EAN-13 forms', () => {
  assert.equal(editionMatch(mb('r1', 'g1', { barcode: '724384960650' }), discogs('9', '7', { barcode: '0724384960650' })), MATCH.SAME);
  assert.equal(editionMatch(mb('r1', 'g1', { barcode: '724384960650' }), discogs('9', '7', { barcode: '0724384960667' })), MATCH.NONE);
});

test('editionMatch: label + catalogue number when there is no barcode', () => {
  const us = mb('r1', 'g1', { label: 'Columbia', catno: 'CL 1355', country: 'US' });
  assert.equal(editionMatch(us, discogs('9', '7', { label: 'Columbia', catno: 'CL-1355', country: 'US' })), MATCH.SAME);
  assert.equal(editionMatch(us, discogs('9', '7', { label: '', catno: 'CL1355' })), MATCH.SAME);
  assert.equal(editionMatch(us, discogs('9', '7', { label: 'Columbia', catno: 'CL 1355', country: 'UK' })), MATCH.PROBABLE);
  assert.equal(editionMatch(us, discogs('9', '7', { label: 'Philips', catno: 'CL 1355' })), MATCH.NONE);
  assert.equal(editionMatch(mb('r1', 'g1'), discogs('9', '7')), MATCH.NONE); // no catalogue number at all
});

test('albumMatch: same source album identifier is decisive', () => {
  assert.equal(albumMatch(mb('r1', 'g1'), mb('r2', 'g1')), MATCH.SAME);
  // Same names but different albums for the source (two “Greatest Hits”).
  assert.equal(albumMatch(mb('r1', 'g1'), mb('r2', 'g2')), MATCH.NONE);
});

test('albumMatch: artist + title across sources or without album identifier', () => {
  assert.equal(albumMatch(mb('r1', 'g1'), discogs('9', '7')), MATCH.PROBABLE);
  assert.equal(albumMatch(mb('r1', ''), mb('r2', 'g1')), MATCH.PROBABLE);
  assert.equal(albumMatch(mb('r1', 'g1'), discogs('9', '7', { title: 'Sketches of Spain' })), MATCH.NONE);
  assert.equal(albumMatch(mb('r1', 'g1'), discogs('9', '7', { artist: 'Bill Evans' })), MATCH.NONE);
});

test('findRelations sorts the library into copies, other editions and wishlist', () => {
  const owned = (id, data) => ({ ...data, id, status: STATUS.OWNED });
  const wanted = (id, data) => ({ ...data, id, status: STATUS.WANTED });
  const records = [
    owned('a', mb('r1', 'g1')),
    owned('b', mb('r1', 'g1')),
    owned('c', mb('r2', 'g1')),
    owned('d', mb('r3', 'g9', { title: 'Blue Train', artist: 'John Coltrane' })),
    wanted('e', mb('', 'g1')),
  ];
  const relations = findRelations(mb('r1', 'g1'), records);
  assert.deepEqual(relations.copies.map((m) => m.record.id), ['a', 'b']);
  assert.deepEqual(relations.otherEditions.map((m) => m.record.id), ['c']);
  assert.deepEqual(relations.wanted.map((m) => m.record.id), ['e']);
  assert.equal(isCertain(relations.copies), true);

  // A record is not related to itself.
  assert.deepEqual(findRelations(records[0], records).copies.map((m) => m.record.id), ['b']);
});
