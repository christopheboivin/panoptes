import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupByAlbum, formatFamily, sortEditions, filterOptions, filterEditions,
} from '../js/models/editions.js';

const edition = (id, groupId, extra = {}) => ({
  title: 'Kind of Blue', artist: 'Miles Davis', source: { provider: 'musicbrainz', id, groupId }, ...extra,
});

test('groupByAlbum groups editions of the same album, in order of appearance', () => {
  const groups = groupByAlbum([
    edition('r1', 'g1'), edition('r2', 'g2'), edition('r3', 'g1'), edition('r4', ''), edition('r5', ''),
  ]);
  assert.deepEqual(groups.map((g) => g.editions.map((e) => e.source.id)), [['r1', 'r3'], ['r2'], ['r4'], ['r5']]);
  assert.equal(groups[0].album.source.id, 'r1');
});

test('groupByAlbum does not mix albums of different sources', () => {
  const groups = groupByAlbum([edition('r1', '7'), { ...edition('9', '7'), source: { provider: 'discogs', id: '9', groupId: '7' } }]);
  assert.equal(groups.length, 2);
});

test('formatFamily', () => {
  assert.equal(formatFamily('12" Vinyl'), 'Vinyl');
  assert.equal(formatFamily('2×Vinyl, LP, Album, Mono'), 'Vinyl');
  assert.equal(formatFamily('CD'), 'CD');
  assert.equal(formatFamily('Hybrid SACD'), 'CD');
  assert.equal(formatFamily('2×DualDisc'), 'CD');
  assert.equal(formatFamily('CD + DVD-Video'), 'CD');
  assert.equal(formatFamily('Cassette'), 'Cassette');
  assert.equal(formatFamily('Digital Media'), 'Digital');
  assert.equal(formatFamily('Reel-to-reel'), 'Other');
  assert.equal(formatFamily('Unknown'), 'Unknown');
  assert.equal(formatFamily(''), 'Unknown');
});

test('sortEditions: oldest first, unknown years last, then country', () => {
  const sorted = sortEditions([
    edition('a', 'g', { year: '', country: 'US' }),
    edition('b', 'g', { year: '1997', country: 'US' }),
    edition('c', 'g', { year: '1959', country: 'US' }),
    edition('d', 'g', { year: '1959', country: 'GB' }),
  ]);
  assert.deepEqual(sorted.map((e) => e.source.id), ['d', 'c', 'b', 'a']);
});

const editions = [
  edition('a', 'g', { year: '1959', country: 'US', format: '12" Vinyl', label: 'Columbia', catno: 'CL 1355' }),
  edition('b', 'g', { year: '1959', country: 'US', format: '12" Vinyl', label: 'Columbia', catno: 'CS 8163' }),
  edition('c', 'g', { year: '1984', country: 'CA', format: 'CD', label: 'CBS', catno: 'CK-8163', barcode: '061213081637' }),
  edition('d', 'g', { year: '1959', country: 'GB', format: '12" Vinyl', label: 'Fontana', catno: 'TFL 5072' }),
];

test('filterOptions counts formats and countries, most frequent first', () => {
  const { formats, countries } = filterOptions(editions);
  assert.deepEqual(formats, [{ value: 'Vinyl', count: 3 }, { value: 'CD', count: 1 }]);
  assert.deepEqual(countries.map((c) => c.value), ['US', 'CA', 'GB']);
});

test('filterEditions by format, country and text', () => {
  const ids = (list) => list.map((e) => e.source.id);
  assert.deepEqual(ids(filterEditions(editions, {})), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(filterEditions(editions, { format: 'CD' })), ['c']);
  assert.deepEqual(ids(filterEditions(editions, { format: 'Vinyl', country: 'US' })), ['a', 'b']);
  assert.deepEqual(ids(filterEditions(editions, { text: 'cl1355' })), ['a']);
  assert.deepEqual(ids(filterEditions(editions, { text: 'CL 1355' })), ['a']);
  assert.deepEqual(ids(filterEditions(editions, { text: 'fontana 1959' })), ['d']);
  assert.deepEqual(ids(filterEditions(editions, { text: '8163' })), ['b', 'c']);
  assert.deepEqual(ids(filterEditions(editions, { text: '061213' })), ['c']);
});
