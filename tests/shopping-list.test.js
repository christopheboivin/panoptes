import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchWords, shopLinks } from '../js/models/shops.js';
import { renderShoppingList } from '../js/ui/shopping-list.js';
import { SHOPS } from '../js/config.js';
import { MATCH } from '../js/models/match.js';

const album = { id: 'w1', status: 'wanted', title: 'So', artist: 'Peter Gabriel', format: 'Vinyl' };

test('shopLinks search “artist title vinyle” in the shops, in their order', () => {
  assert.equal(searchWords(album), 'Peter Gabriel So vinyle');
  assert.equal(searchWords({ ...album, format: '' }), 'Peter Gabriel So');
  const links = shopLinks({ ...album, title: 'So & Co' }, SHOPS);
  assert.deepEqual(links.map((link) => link.name), ['Fnac', 'Cultura', 'Amazon']);
  assert.equal(links[2].href, 'https://www.amazon.fr/s?k=Peter%20Gabriel%20So%20%26%20Co%20vinyle&i=popular');
});

test('renderShoppingList: albums by artist with escaped data, shop links and owned hints', () => {
  const html = renderShoppingList([album, { ...album, id: 'w2', title: '<i>Us</i>' }], {
    shops: SHOPS,
    relationsById: new Map([['w1', { copies: [], otherEditions: [{ record: { format: 'CD' }, level: MATCH.SAME }], wanted: [] }]]),
    date: new Date('2026-11-22T12:00:00Z'),
  });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /2 albums · 22 November 2026/);
  assert.match(html, /<h2>Peter Gabriel<\/h2>/);
  assert.match(html, /&lt;i&gt;Us&lt;\/i&gt;/);
  assert.match(html, /You own it on CD only/);
  assert.equal(html.match(/rel="noopener noreferrer">Fnac</g).length, 2);
  assert.doesNotMatch(html, /<script/);
});
