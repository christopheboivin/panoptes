import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByArtist } from '../js/models/artists.js';

test('groupByArtist: one group per artist, “The” ignored for sorting, records by year then title', () => {
  const groups = groupByArtist([
    { artist: 'Miles Davis', title: 'Kind of Blue', year: '1959' },
    { artist: 'The Beatles', title: 'Abbey Road', year: '1969' },
    { artist: 'miles davis', title: 'Birth of the Cool', year: '' },
    { artist: 'Miles Davis', title: 'Bitches Brew', year: '1970' },
  ]);
  assert.deepEqual(groups.map((g) => g.artist), ['The Beatles', 'Miles Davis']);
  assert.deepEqual(groups[1].records.map((r) => r.title), ['Kind of Blue', 'Bitches Brew', 'Birth of the Cool']);
});
