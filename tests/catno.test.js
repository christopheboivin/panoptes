import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCatalogNumbers, mergeSuggestions, bestSuggestion } from '../js/models/catno.js';
import { frameToVideoRect, ocrImageSize } from '../js/scanner/frame.js';

const numbers = (text) => extractCatalogNumbers(text).catalogNumbers;

test('catalogue numbers are offered whole, as printed, whatever their length', () => {
  assert.equal(numbers('PGLP 21\n')[0], 'PGLP 21');
  assert.equal(numbers('CDP 7 46001 2')[0], 'CDP 7 46001 2');
  assert.equal(numbers('7243 8 57826 2 7')[0], '7243 8 57826 2 7');
  assert.deepEqual(numbers('7243 B 57826 2 7'), ['7243 B 57826 2 7']); // misread 8, not cut
  assert.equal(numbers('1234567890123456')[0], '1234567890123456');
  assert.equal(numbers('STEREO PCS 7088')[0], 'PCS 7088');
  assert.equal(numbers('CAT. NO. PGLP 21')[0], 'PGLP 21');
  assert.deepEqual(numbers('LC 16158'), []); // a Label Code
});

test('suggestions accumulate and the most read stands out', () => {
  let list = mergeSuggestions([], { catalogNumbers: ['PGLP 21'], barcode: '' });
  list = mergeSuggestions(list, { catalogNumbers: ['PGLP 2I', 'PGLP 21'], barcode: '' });
  assert.deepEqual(list.map((s) => [s.value, s.hits]), [['PGLP 21', 2], ['PGLP 2I', 1]]);
  assert.equal(bestSuggestion(list).value, 'PGLP 21');
});

test('a valid barcode in the frame is offered as a barcode', () => {
  assert.equal(extractCatalogNumbers('0 724384 960650').barcode, '0724384960650');
  assert.equal(extractCatalogNumbers('724384960650').barcode, '724384960650');
  assert.equal(extractCatalogNumbers('0 724384 960651').barcode, ''); // wrong check digit
  assert.equal(extractCatalogNumbers('PGLP 21').barcode, '');
});

test('frameToVideoRect: video cut on the sides (object-fit: cover)', () => {
  // 1280×720 camera shown in a 360×360 box: scale 0.5, 140 px cut on each side.
  const rect = frameToVideoRect({ width: 1280, height: 720 }, { width: 360, height: 360 }, { x: 30, y: 150, width: 300, height: 60 });
  assert.deepEqual(rect, { x: 340, y: 300, width: 600, height: 120 });
});

test('frameToVideoRect: video cut at the top and bottom, rectangle kept inside the image', () => {
  const rect = frameToVideoRect({ width: 720, height: 1280 }, { width: 360, height: 360 }, { x: -10, y: 0, width: 400, height: 40 });
  assert.deepEqual(rect, { x: 0, y: 280, width: 720, height: 80 });
});

test('ocrImageSize enlarges small text and reduces large crops', () => {
  assert.deepEqual(ocrImageSize({ width: 300, height: 30 }), { width: 1200, height: 120 });
  assert.deepEqual(ocrImageSize({ width: 600, height: 120 }), { width: 600, height: 120 });
  assert.deepEqual(ocrImageSize({ width: 1600, height: 400 }), { width: 800, height: 200 });
  assert.deepEqual(ocrImageSize({ width: 0, height: 0 }), { width: 0, height: 0 });
});
