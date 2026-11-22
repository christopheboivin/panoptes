import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCandidate, formatMedia, buildTextQuery, barcodeVariants } from '../js/providers/musicbrainz.js';

// Extrait représentatif d'une réponse de recherche MusicBrainz (/ws/2/release?fmt=json).
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

test('toCandidate convertit une release MusicBrainz', () => {
  const candidate = toCandidate(release);
  assert.equal(candidate.title, 'Abbey Road');
  assert.equal(candidate.artist, 'The Beatles');
  assert.equal(candidate.year, '1969');
  assert.equal(candidate.format, '12" Vinyl');
  assert.equal(candidate.label, 'Apple Records');
  assert.equal(candidate.catno, 'PCS 7088');
  assert.deepEqual(candidate.source, { provider: 'musicbrainz', id: 'rel-1' });
  assert.equal(candidate.coverUrls.length, 2);
});

test('toCandidate tolère une release incomplète', () => {
  const candidate = toCandidate({ id: 'x', title: 'Inconnu' });
  assert.equal(candidate.artist, '');
  assert.equal(candidate.year, '');
  assert.equal(candidate.coverUrls.length, 1);
});

test('formatMedia regroupe les supports identiques', () => {
  assert.equal(formatMedia([{ format: 'CD' }, { format: 'CD' }]), '2×CD');
  assert.equal(formatMedia([{ format: '12" Vinyl' }, { format: 'CD' }]), '12" Vinyl + CD');
  assert.equal(formatMedia([]), '');
});

test('buildTextQuery combine artiste et titre et échappe les guillemets', () => {
  assert.equal(buildTextQuery({ artist: 'AC/DC', title: '' }), 'artist:"AC/DC"');
  assert.equal(
    buildTextQuery({ artist: 'Miles Davis', title: 'Kind of "Blue"' }),
    'artist:"Miles Davis" AND release:"Kind of \\"Blue\\""',
  );
  assert.equal(buildTextQuery({}), '');
  assert.equal(buildTextQuery({ catno: ' PGLP21 ' }), 'catno:"PGLP21"');
});

test('barcodeVariants couvre les formes UPC-A et EAN-13', () => {
  assert.deepEqual(barcodeVariants('884108013632'), ['884108013632', '0884108013632']);
  assert.deepEqual(barcodeVariants('0884108013632'), ['0884108013632', '884108013632']);
  assert.deepEqual(barcodeVariants('5099902987026'), ['5099902987026']);
  assert.deepEqual(barcodeVariants(''), []);
});
