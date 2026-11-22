import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecord, validateRecord, toAlbum, STATUS } from '../js/models/record.js';

const candidate = {
  title: '  Kind of Blue ',
  artist: 'Miles Davis',
  year: 1959,
  source: { provider: 'musicbrainz', id: 'abc' },
  coverUrls: ['https://example.org/a.jpg', 'http://insecure.example.org/b.jpg', 42],
};

test('createRecord normalises fields and adds id and dates', () => {
  const now = new Date('2026-11-22T10:00:00Z');
  const record = createRecord(candidate, STATUS.WANTED, now);
  assert.equal(record.title, 'Kind of Blue');
  assert.equal(record.year, '1959');
  assert.equal(record.label, '');
  assert.equal(record.status, STATUS.WANTED);
  assert.equal(record.addedAt, now.toISOString());
  assert.ok(record.id.length > 0);
  assert.deepEqual(record.coverUrls, ['https://example.org/a.jpg']);
});

test('validateRecord rejects an unknown status or an empty title', () => {
  assert.throws(() => validateRecord({ id: 'x', status: 'lost', title: 'A' }), /status/);
  assert.throws(() => validateRecord({ id: 'x', status: STATUS.OWNED, title: '  ' }), /title/);
  assert.throws(() => validateRecord(null), /object/);
});

test('validateRecord keeps the album identifier and fills it in for older records', () => {
  const record = createRecord({ ...candidate, source: { provider: 'musicbrainz', id: 'abc', groupId: 'rg' } }, STATUS.OWNED);
  assert.deepEqual(record.source, { provider: 'musicbrainz', id: 'abc', groupId: 'rg' });
  const older = validateRecord({ id: 'x', status: STATUS.OWNED, title: 'A', source: { provider: 'discogs', id: '1' } });
  assert.deepEqual(older.source, { provider: 'discogs', id: '1', groupId: '' });
  const manual = validateRecord({ id: 'y', status: STATUS.OWNED, title: 'B' });
  assert.deepEqual(manual.source, { provider: '', id: '', groupId: '' });
});

test('toAlbum keeps the album and drops the edition details', () => {
  const edition = {
    ...candidate, format: '12" Vinyl', label: 'Columbia', catno: 'CL 1355', barcode: '123', country: 'US',
    source: { provider: 'musicbrainz', id: 'abc', groupId: 'rg' },
  };
  const album = createRecord(toAlbum(edition), STATUS.WANTED);
  assert.equal(album.title, 'Kind of Blue');
  assert.equal(album.artist, 'Miles Davis');
  for (const field of ['year', 'label', 'catno', 'barcode', 'country']) assert.equal(album[field], '', field);
  assert.equal(album.format, 'Vinyl', 'format wanted, not the edition\'s');
  assert.equal(createRecord(toAlbum(edition, ''), STATUS.WANTED).format, '');
  assert.deepEqual(album.source, { provider: 'musicbrainz', id: '', groupId: 'rg' });
  assert.deepEqual(album.coverUrls, ['https://example.org/a.jpg']);
});
