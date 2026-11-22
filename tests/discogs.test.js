import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toCandidate, splitTitle, cleanArtistName, formatDescriptions, pickBarcode, buildSearchParams, createDiscogsProvider,
  versionToCandidate,
} from '../js/providers/discogs.js';

// Representative excerpt of a /database/search?type=release result.
const result = {
  id: 28457123,
  title: 'Peter Gabriel - I/O',
  year: '2023',
  country: 'Europe',
  format: ['Vinyl', 'LP', 'Album', 'Vinyl', 'LP', 'Album'],
  format_quantity: 2,
  label: ['Real World Records', 'Real World Productions'],
  catno: 'PGLP21',
  master_id: 2913437,
  barcode: ['884108013632', 'PGLP21 A1', '8 84108 01363 2'],
  cover_image: 'https://i.discogs.com/cover.jpeg',
  thumb: 'https://i.discogs.com/thumb.jpeg',
};

test('toCandidate converts a Discogs result', () => {
  const candidate = toCandidate(result);
  assert.equal(candidate.artist, 'Peter Gabriel');
  assert.equal(candidate.title, 'I/O');
  assert.equal(candidate.year, '2023');
  assert.equal(candidate.format, '2×Vinyl, LP, Album');
  assert.equal(candidate.label, 'Real World Records');
  assert.equal(candidate.catno, 'PGLP21');
  assert.equal(candidate.barcode, '884108013632');
  assert.deepEqual(candidate.source, { provider: 'discogs', id: '28457123', groupId: '2913437' });
  assert.deepEqual(candidate.coverUrls, ['https://i.discogs.com/cover.jpeg', 'https://i.discogs.com/thumb.jpeg']);
});

test('toCandidate tolerates an incomplete result and ignores empty images', () => {
  const candidate = toCandidate({ id: 1, title: 'No artist', catno: 'none', cover_image: 'https://st.discogs.com/images/spacer.gif' });
  assert.equal(candidate.title, 'No artist');
  assert.equal(candidate.artist, '');
  assert.equal(candidate.catno, '');
  assert.equal(candidate.format, '');
  assert.equal(candidate.source.groupId, ''); // no master
  assert.deepEqual(candidate.coverUrls, []);
});

test('splitTitle and cleanArtistName handle namesakes and dashes', () => {
  assert.deepEqual(splitTitle('Genesis (2) - Live - Paris'), { artist: 'Genesis', title: 'Live - Paris' });
  assert.equal(cleanArtistName('Yes (3)'), 'Yes');
  assert.equal(cleanArtistName('Blink-182'), 'Blink-182');
});

test('formatDescriptions and pickBarcode', () => {
  assert.equal(formatDescriptions(['CD', 'Album'], 1), 'CD, Album');
  assert.equal(formatDescriptions([], 2), '');
  assert.equal(pickBarcode(['IFPI L123', '5 099902 987026']), '5099902987026');
  assert.equal(pickBarcode(['PGLP21 A1']), '');
});

test('buildSearchParams ignores empty criteria and adds the token', () => {
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

test('without a token, Discogs is not configured and makes no network call', async () => {
  let calls = 0;
  const discogs = createDiscogsProvider({ getToken: () => '', fetchFn: async () => { calls += 1; } });
  assert.equal(discogs.isConfigured(), false);
  assert.deepEqual(await discogs.searchByBarcode('884108013632'), []);
  assert.equal(calls, 0);
});

test('searchByBarcode queries Discogs with the token and converts the results', async () => {
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

test('a rejected token gives an explicit message', async () => {
  const discogs = createDiscogsProvider({ getToken: () => 'faux', fetchFn: async () => fakeResponse(401) });
  await assert.rejects(discogs.searchByText({ artist: 'X' }), /token/);
});

test('versionToCandidate completes a master version with the album', async () => {
  const { readFileSync } = await import('node:fs');
  const { versions } = JSON.parse(readFileSync(new URL('./fixtures/discogs-master-versions.json', import.meta.url)));
  const album = { title: 'Kind Of Blue', artist: 'Miles Davis', source: { provider: 'discogs', groupId: '5460' } };
  const [first, second] = versions.map((version) => versionToCandidate(version, album));
  assert.equal(first.artist, 'Miles Davis');
  assert.equal(first.format, 'Vinyl, LP, Album, Mono');
  assert.equal(first.label, 'Coronet');
  assert.equal(first.country, 'Australia');
  assert.equal(first.year, '1959');
  assert.equal(first.barcode, '');
  assert.deepEqual(first.source, { provider: 'discogs', id: '26677274', groupId: '5460' });
  assert.equal(first.coverUrls.length, 1);
  assert.equal(second.catno, 'KLP893'); // first of “KLP893, KLP-893, KLP - 893”
});

test('listEditions pages through the versions of the master', async () => {
  const { readFileSync } = await import('node:fs');
  const page = JSON.parse(readFileSync(new URL('./fixtures/discogs-master-versions.json', import.meta.url)));
  const urls = [];
  const responses = [page, { pagination: { page: 2, pages: 2 }, versions: [] }];
  const discogs = createDiscogsProvider({
    getToken: () => '',
    fetchFn: async (url) => { urls.push(new URL(url)); return fakeResponse(200, responses.shift()); },
    sleepFn: async () => {},
  });
  const pages = [];
  for await (const editions of discogs.listEditions({ title: 'Kind Of Blue', artist: 'Miles Davis', source: { provider: 'discogs', groupId: '5460' } })) {
    pages.push(editions);
  }
  assert.deepEqual(pages.map((p) => p.length), [3, 0]);
  assert.equal(urls[0].pathname, '/masters/5460/versions');
  assert.equal(urls[1].searchParams.get('page'), '2');
  assert.equal(urls[0].searchParams.has('token'), false);
});
