import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidBarcode, normalizeBarcode } from '../js/models/barcode.js';

test('isValidBarcode accepte des codes à clé correcte', () => {
  assert.equal(isValidBarcode('0724384960650'), true); // EAN-13
  assert.equal(isValidBarcode('724384960650'), true); // UPC-A
  assert.equal(isValidBarcode('96385074'), true); // EAN-8
});

test('isValidBarcode refuse une clé fausse ou une longueur inconnue', () => {
  assert.equal(isValidBarcode('0724384960651'), false);
  assert.equal(isValidBarcode('12345'), false);
  assert.equal(isValidBarcode(''), false);
});

test('normalizeBarcode ne garde que les chiffres', () => {
  assert.equal(normalizeBarcode(' 0 72438-496065 0 '), '0724384960650');
});
