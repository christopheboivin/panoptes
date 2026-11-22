/**
 * Catalogue numbers read by OCR: suggestions extracted from the raw text of
 * the camera frame, and their accumulation over successive readings.
 * Pure functions.
 *
 * There is no formal syntax for catalogue numbers: each label has its own,
 * and MusicBrainz and Discogs both ask to transcribe them as printed. The
 * rules below follow the MusicBrainz description
 * (https://musicbrainz.org/doc/Release/Catalog_Number):
 *   - “alphanumeric characters, often letters followed by numbers, perhaps
 *     separated by a dash, space or other punctuation”: a candidate is a run of
 *     words made of letters, then of words containing digits;
 *   - no length or structure limit is given: none is imposed;
 *   - numbers of major labels can be “similar or exactly the same as the
 *     barcode”, usually without its check digit: a digits-only number is a
 *     catalogue number, unless it is a valid barcode (then offered as such);
 *   - a Label Code (“LC 16158”) and an Amazon ASIN are not catalogue numbers.
 * Requiring at least one digit, and offering the shortest letter prefix
 * first, are the only additions: they leave out the words around the number
 * (“STEREO”, “CAT. NO.”). The user picks among the suggestions, and can still
 * correct the chosen one before searching.
 */

import { isValidBarcode } from './barcode.js';

/** Suggestions taken from a single reading. */
const MAX_PER_READING = 4;

/** Suggestions kept on screen (see mergeSuggestions). */
export const MAX_SUGGESTIONS = 6;

const hasDigit = (word) => /\d/.test(word);

/** Label Code (LC 1234, LC-01234, LC16158) or Amazon ASIN (B0…, 10 characters). */
function isOtherCode(text) {
  return /^LC[\s-]?\d{4,5}$/.test(text) || /^B0[0-9A-Z]{8}$/.test(text);
}

/** Upper case, catalogue-number characters only, single spaces. */
function cleanLine(line) {
  return line.toUpperCase().replace(/[^A-Z0-9 ./-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Candidates of one line: each run of letter words followed by words with
 * digits (“PCS 7088”), and the same run without some of its leading letter
 * words (“STEREO PCS 7088” → also “PCS 7088”). A letter word after digits
 * ends the run (“CL 1355 LP” → “CL 1355”).
 * @returns {Array<{text: string, prefixWords: number}>}
 */
function lineCandidates(line) {
  const words = line.split(' ').map((word) => word.replace(/^[./-]+|[./-]+$/g, '')).filter(Boolean);
  const candidates = [];
  let index = 0;
  while (index < words.length) {
    const prefixStart = index;
    while (index < words.length && !hasDigit(words[index])) index += 1;
    const digitsStart = index;
    // A single letter between digit groups stays in the number: usually a misread digit (B/8, O/0, I/1).
    const continues = (i) => hasDigit(words[i]) || (/^[A-Z]$/.test(words[i]) && i > digitsStart && hasDigit(words[i + 1] ?? ''));
    while (index < words.length && continues(index)) index += 1;
    const numbers = words.slice(digitsStart, index);
    const isCode = digitsStart > prefixStart && isOtherCode([words[digitsStart - 1], ...numbers].join(' '));
    if (numbers.length > 0 && !isCode) {
      for (let start = prefixStart; start <= digitsStart; start += 1) {
        candidates.push({ text: [...words.slice(start, digitsStart), ...numbers].join(' '), prefixWords: digitsStart - start });
      }
    }
  }
  return candidates;
}

/** One letter prefix (“PCS 7088”) first, then none (“7243 8 57826 2 7”), then longer prefixes. */
function rank({ prefixWords }) {
  return prefixWords === 1 ? 0 : prefixWords === 0 ? 1 : prefixWords;
}

/**
 * Suggestions read from the OCR text of the camera frame.
 * @param {string} text - raw OCR text (one or more lines)
 * @returns {{ catalogNumbers: string[], barcode: string }}
 *   catalogNumbers: as printed, most likely first;
 *   barcode: a 12/13-digit code with a valid check digit, if the frame holds one.
 */
export function extractCatalogNumbers(text) {
  const lines = String(text ?? '').split(/\n+/).map(cleanLine).filter(Boolean);
  let barcode = '';
  const candidates = [];
  for (const line of lines) {
    for (const candidate of lineCandidates(line)) {
      const digits = candidate.text.replace(/[\s-]/g, '');
      if (/^\d{12,13}$/.test(digits) && isValidBarcode(digits)) {
        barcode ||= digits;
        continue;
      }
      if (isOtherCode(candidate.text)) continue;
      candidates.push(candidate);
    }
  }
  const ordered = candidates
    .map((candidate, position) => ({ ...candidate, position }))
    .sort((a, b) => rank(a) - rank(b) || a.position - b.position)
    .map((candidate) => candidate.text);
  return { catalogNumbers: [...new Set(ordered)].slice(0, MAX_PER_READING), barcode };
}

/**
 * Accumulates suggestions over successive readings, so that they stay put
 * while the user aims: each keeps its place (order of first appearance) and
 * counts how many readings saw it. When the list is full, a new suggestion
 * replaces the one read the fewest times (the oldest among equals).
 * @param {Array<{value: string, kind: 'catno'|'barcode', hits: number}>} list - current suggestions
 * @param {{ catalogNumbers: string[], barcode: string }} found - extractCatalogNumbers() of the last reading
 * @returns a new list (the given one is not modified)
 */
export function mergeSuggestions(list, { catalogNumbers, barcode }, max = MAX_SUGGESTIONS) {
  const next = list.map((suggestion) => ({ ...suggestion }));
  const items = [
    ...catalogNumbers.map((value) => ({ value, kind: 'catno' })),
    ...(barcode ? [{ value: barcode, kind: 'barcode' }] : []),
  ];
  for (const item of items) {
    const known = next.find((suggestion) => suggestion.kind === item.kind && suggestion.value === item.value);
    if (known) {
      known.hits += 1;
      continue;
    }
    if (next.length >= max) {
      let weakest = 0;
      next.forEach((suggestion, index) => {
        if (suggestion.hits < next[weakest].hits) weakest = index;
      });
      next.splice(weakest, 1);
    }
    next.push({ ...item, hits: 1 });
  }
  return next;
}

/** The suggestion read most often, if read at least twice (the first among equals); otherwise null. */
export function bestSuggestion(list) {
  let best = null;
  for (const suggestion of list) {
    if (suggestion.hits >= 2 && (!best || suggestion.hits > best.hits)) best = suggestion;
  }
  return best;
}
