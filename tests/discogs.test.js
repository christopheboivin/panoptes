import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toCandidate, splitTitle, cleanArtistName, formatDescriptions, pickBarcode, buildSearchParams, createDiscogsProvider,
} from '../js/providers/discogs.js';

// Extrait représentatif d'un résultat de /database/search?type=release.
const result = {
  id: 28457123,
  title: 'Peter Gabriel - I/O',
  year: '2023',
  country: 'Europe',
  format: ['Vinyl', 'LP', 'Album', 'Vinyl', 'LP', 'Album'],
  format_quantity: 2,
  label: ['Real World Records', 'Real World Productions'],
  catno: 'PGLP21',
  barcode: ['884108013632', 'PGLP21 A1', '8 84108 01363 2'],
  cover_image: 'https://i.discogs.com/cover.jpeg',
  thumb: 'https://i.discogs.com/thumb.jpeg',
};

test('toCandidate convertit un résultat Discogs', () => {
  const candidate = toCandidate(result);
  assert.equal(candidate.artist, 'Peter Gabriel');
  assert.equal(candidate.title, 'I/O');
  assert.equal(candidate.year, '2023');
  assert.equal(candidate.format, '2×Vinyl, LP, Album');
  assert.equal(candidate.label, 'Real World Records');
  assert.equal(candidate.catno, 'PGLP21');
  assert.equal(candidate.barcode, '884108013632');
  assert.deepEqual(candidate.source, { provider: 'discogs', id: '28457123' });
  assert.deepEqual(candidate.coverUrls, ['https://i.discogs.com/cover.jpeg', 'https://i.discogs.com/thumb.jpeg']);
});

test('toCandidate tolère un résultat incomplet et ignore les images vides', () => {
  const candidate = toCandidate({ id: 1, title: 'Sans artiste', catno: 'none', cover_image: 'https://st.discogs.com/images/spacer.gif' });
  assert.equal(candidate.title, 'Sans artiste');
  assert.equal(candidate.artist, '');
  assert.equal(candidate.catno, '');
  assert.equal(candidate.format, '');
  assert.deepEqual(candidate.coverUrls, []);
});

test('splitTitle et cleanArtistName gèrent les homonymes et les tirets', () => {
  assert.deepEqual(splitTitle('Genesis (2) - Live - Paris'), { artist: 'Genesis', title: 'Live - Paris' });
  assert.equal(cleanArtistName('Yes (3)'), 'Yes');
  assert.equal(cleanArtistName('Blink-182'), 'Blink-182');
});

test('formatDescriptions et pickBarcode', () => {
  assert.equal(formatDescriptions(['CD', 'Album'], 1), 'CD, Album');
  assert.equal(formatDescriptions([], 2), '');
  assert.equal(pickBarcode(['IFPI L123', '5 099902 987026']), '5099902987026');
  assert.equal(pickBarcode(['PGLP21 A1']), '');
});

test('buildSearchParams ignore les critères vides et ajoute le jeton', () => {
  const params = buildSearchParams({ artist: ' Peter Gabriel ', title: '', catno: 'PGLP21' }, 'secret');
  assert.equal(params.get('type'), 'release');
  assert.equal(params.get('artist'), 'Peter Gabriel');
  assert.equal(params.get('catno'), 'PGLP21');
  assert.equal(params.has('release_title'), false);
  assert.equal(params.get('token'), 'secret');
});

function fakeResponse(status, body = {}) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

test('sans jeton, Discogs n\'est pas configuré et n\'appelle pas le réseau', async () => {
  let calls = 0;
  const discogs = createDiscogsProvider({ getToken: () => '', fetchFn: async () => { calls += 1; } });
  assert.equal(discogs.isConfigured(), false);
  assert.deepEqual(await discogs.searchByBarcode('884108013632'), []);
  assert.equal(calls, 0);
});

test('searchByBarcode interroge Discogs avec le jeton et convertit les résultats', async () => {
  const urls = [];
  const discogs = createDiscogsProvider({
    getToken: () => 'secret',
    fetchFn: async (url) => { urls.push(new URL(url)); return fakeResponse(200, { results: [result] }); },
  });
  const candidates = await discogs.searchByBarcode('884108013632');
  assert.equal(candidates.length, 1);
  assert.equal(urls[0].pathname, '/database/search');
  assert.equal(urls[0].searchParams.get('barcode'), '884108013632');
  assert.equal(urls[0].searchParams.get('token'), 'secret');
});

test('un jeton refusé produit un message explicite', async () => {
  const discogs = createDiscogsProvider({ getToken: () => 'faux', fetchFn: async () => fakeResponse(401) });
  await assert.rejects(discogs.searchByText({ artist: 'X' }), /jeton/);
});
