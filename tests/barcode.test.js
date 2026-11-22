import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidBarcode, normalizeBarcode, canonicalBarcode } from '../js/models/barcode.js';

test('canonicalBarcode writes a UPC-A in its EAN-13 form', () => {
  assert.equal(canonicalBarcode('724384960650'), '0724384960650');
  assert.equal(canonicalBarcode('0724384960650'), '0724384960650');
  assert.equal(canonicalBarcode('96385074'), '96385074');
  assert.equal(canonicalBarcode(''), '');
});

test('isValidBarcode accepts codes with a correct check digit', () => {
  assert.equal(isValidBarcode('0724384960650'), true); // EAN-13
  assert.equal(isValidBarcode('724384960650'), true); // UPC-A
  assert.equal(isValidBarcode('96385074'), true); // EAN-8
});

test('isValidBarcode rejects a wrong check digit or an unknown length', () => {
  assert.equal(isValidBarcode('0724384960651'), false);
  assert.equal(isValidBarcode('12345'), false);
  assert.equal(isValidBarcode(''), false);
});

test('normalizeBarcode keeps digits only', () => {
  assert.equal(normalizeBarcode(' 0 72438-496065 0 '), '0724384960650');
});
