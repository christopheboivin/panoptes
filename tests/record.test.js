import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecord, validateRecord, sameRelease, STATUS } from '../js/models/record.js';

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

test('sameRelease compares the external source', () => {
  const a = createRecord(candidate, STATUS.OWNED);
  const b = createRecord(candidate, STATUS.WANTED);
  const c = createRecord({ ...candidate, source: { provider: 'musicbrainz', id: 'other' } }, STATUS.OWNED);
  const manual = createRecord({ title: 'No source' }, STATUS.OWNED);
  assert.equal(sameRelease(a, b), true);
  assert.equal(sameRelease(a, c), false);
  assert.equal(sameRelease(manual, manual), false);
});
