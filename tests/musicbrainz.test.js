import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toCandidate, formatMedia, buildTextQuery, barcodeVariants, createMusicBrainzProvider,
} from '../js/providers/musicbrainz.js';

// Representative excerpt of a MusicBrainz search response (/ws/2/release?fmt=json).
const release = {
  id: 'rel-1',
  title: 'Abbey Road',
  date: '1969-09-26',
  country: 'GB',
  barcode: '0077774644624',
  'artist-credit': [{ name: 'The Beatles', joinphrase: '' }],
  'label-info': [{ 'catalog-number': 'PCS 7088', label: { name: 'Apple Records' } }],
  'release-group': { id: 'rg-1' },
  media: [{ format: '12" Vinyl' }],
};

test('toCandidate converts a MusicBrainz release', () => {
  const candidate = toCandidate(release);
  assert.equal(candidate.title, 'Abbey Road');
  assert.equal(candidate.artist, 'The Beatles');
  assert.equal(candidate.year, '1969');
  assert.equal(candidate.format, '12" Vinyl');
  assert.equal(candidate.label, 'Apple Records');
  assert.equal(candidate.catno, 'PCS 7088');
  assert.deepEqual(candidate.source, { provider: 'musicbrainz', id: 'rel-1', groupId: 'rg-1' });
  assert.equal(candidate.coverUrls.length, 2);
});

test('toCandidate tolerates an incomplete release', () => {
  const candidate = toCandidate({ id: 'x', title: 'Unknown' });
  assert.equal(candidate.artist, '');
  assert.equal(candidate.year, '');
  assert.equal(candidate.coverUrls.length, 1);
});

test('formatMedia groups identical media', () => {
  assert.equal(formatMedia([{ format: 'CD' }, { format: 'CD' }]), '2×CD');
  assert.equal(formatMedia([{ format: '12" Vinyl' }, { format: 'CD' }]), '12" Vinyl + CD');
  assert.equal(formatMedia([]), '');
});

test('buildTextQuery combines artist and title and escapes quotes', () => {
  assert.equal(buildTextQuery({ artist: 'AC/DC', title: '' }), 'artist:"AC/DC"');
  assert.equal(
    buildTextQuery({ artist: 'Miles Davis', title: 'Kind of "Blue"' }),
    'artist:"Miles Davis" AND release:"Kind of \\"Blue\\""',
  );
  assert.equal(buildTextQuery({}), '');
  assert.equal(buildTextQuery({ catno: ' PGLP21 ' }), 'catno:"PGLP21"');
});

test('barcodeVariants covers the UPC-A and EAN-13 forms', () => {
  assert.deepEqual(barcodeVariants('884108013632'), ['884108013632', '0884108013632']);
  assert.deepEqual(barcodeVariants('0884108013632'), ['0884108013632', '884108013632']);
  assert.deepEqual(barcodeVariants('5099902987026'), ['5099902987026']);
  assert.deepEqual(barcodeVariants(''), []);
});

test('listEditions browses the releases of the release group, page by page', async () => {
  const { readFileSync } = await import('node:fs');
  const page = JSON.parse(readFileSync(new URL('./fixtures/musicbrainz-release-browse.json', import.meta.url)));
  const urls = [];
  const responses = [page, { 'release-count': page['release-count'], releases: [] }];
  const musicbrainz = createMusicBrainzProvider({
    fetchFn: async (url) => { urls.push(new URL(url)); return { status: 200, ok: true, json: async () => responses.shift() }; },
    sleepFn: async () => {},
  });
  const pages = [];
  for await (const editions of musicbrainz.listEditions({ source: { provider: 'musicbrainz', groupId: 'rg-kob' } })) {
    pages.push(editions);
  }
  assert.equal(pages.length, 2);
  assert.equal(urls[0].searchParams.get('release-group'), 'rg-kob');
  assert.equal(urls[0].searchParams.get('offset'), '0');
  assert.equal(urls[1].searchParams.get('offset'), '3');
  const [cd, vinyl, unknown] = pages[0];
  assert.deepEqual(
    { format: cd.format, country: cd.country, label: cd.label, catno: cd.catno, barcode: cd.barcode, year: cd.year },
    { format: 'CD', country: 'CA', label: 'CBS', catno: 'CK-8163', barcode: '061213081637', year: '1984' },
  );
  assert.equal(vinyl.format, '12" Vinyl');
  assert.equal(vinyl.artist, 'Miles Davis');
  assert.equal(vinyl.source.groupId, 'rg-kob');
  assert.equal(unknown.barcode, '');
  assert.equal(unknown.format, 'Unknown');
});

test('a persistent 503 gives an explicit message', async () => {
  const musicbrainz = createMusicBrainzProvider({
    fetchFn: async () => ({ status: 503, ok: false }),
    sleepFn: async () => {},
  });
  await assert.rejects(musicbrainz.searchByText({ artist: 'X' }), /rate limit/);
});
