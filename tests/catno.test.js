import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCatalogNumbers } from '../js/models/catno.js';
import { frameToVideoRect, ocrImageSize } from '../js/scanner/frame.js';

const numbers = (text) => extractCatalogNumbers(text).catalogNumbers;

test('a clean catalogue number, with its compact form', () => {
  assert.deepEqual(numbers('PGLP 21\n'), ['PGLP 21', 'PGLP21']);
  assert.deepEqual(numbers('PGLP21'), ['PGLP21']);
  assert.deepEqual(numbers('CL 1355'), ['CL 1355', 'CL1355']); // not “1355” alone
  assert.equal(numbers('2C 064-12345')[0], '2C 064-12345');
  assert.equal(numbers('CDP 7 46001 2')[0], 'CDP 7 46001 2');
});

test('neighbouring words are left out', () => {
  assert.equal(numbers('CAT. NO. PGLP 21')[0], 'PGLP 21');
  assert.equal(numbers('STEREO PCS 7088')[0], 'PCS 7088');
  assert.equal(numbers('CL 1355 LP')[0], 'CL 1355');
  assert.equal(numbers('COLUMBIA CL 1355 MONO')[0], 'CL 1355');
});

test('OCR noise is cleaned up', () => {
  assert.equal(numbers('  |PGLP 21.\n')[0], 'PGLP 21');
  assert.equal(numbers('pglp 21')[0], 'PGLP 21');
  assert.equal(numbers('— KLP-893 —')[0], 'KLP-893');
});

test('years, lone letters and long digit runs are not catalogue numbers', () => {
  assert.deepEqual(numbers('1977'), []);
  assert.deepEqual(numbers('STEREO'), []);
  assert.deepEqual(numbers(''), []);
  assert.deepEqual(numbers('5099902987026'), []);
});

test('a number spelt twice is offered once', () => {
  const result = numbers('CL 1355\nCL-1355');
  assert.equal(result.filter((n) => n.replace(/\W/g, '') === 'CL1355').length, 2); // “CL 1355” and its compact form
});

test('suggestions are limited', () => {
  assert.ok(numbers('AB 12 CD 34 EF 56 GH 78 IJ 90').length <= 4);
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
