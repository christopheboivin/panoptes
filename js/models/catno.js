/**
 * Catalogue numbers read by OCR: suggestions extracted from the raw text of
 * the camera frame. Pure functions.
 *
 * A catalogue number is, roughly, an optional letter prefix followed by
 * groups of digits: “PGLP 21”, “CL 1355”, “2C 064-12345”, “CDP 7 46001 2”.
 * The frame often also catches neighbouring words (“STEREO”, “CAT. NO.”) and
 * OCR misreads characters: several suggestions are offered, the user picks
 * and can still correct before searching.
 */

import { isValidBarcode } from './barcode.js';

/** Most suggestions offered at once. */
const MAX_SUGGESTIONS = 4;

/** Letters-only word allowed as prefix (“CL”, “PCS”, “SHVL”), or digit + letters (“2C”). */
function isPrefix(word) {
  return /^[A-Z]{1,5}$/.test(word) || /^\d[A-Z]{1,3}$/.test(word);
}

function hasDigit(text) {
  return /\d/.test(text);
}

function alnumLength(text) {
  return text.replace(/[^A-Z0-9]/g, '').length;
}

/** Same catalogue number written with or without separators. */
function compact(text) {
  return text.replace(/[^A-Z0-9]/g, '');
}

/** Upper case, catalogue-number characters only, single spaces. */
function cleanLine(line) {
  return line.toUpperCase().replace(/[^A-Z0-9 ./-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Score of a candidate made of consecutive words; 0 = not a catalogue number. */
function score(words) {
  const text = words.join(' ');
  const length = alnumLength(text);
  if (length < 3 || length > 16) return 0;
  if (!hasDigit(words.at(-1))) return 0; // ends with digits: “PGLP 21”, not “CL 1355 LP”
  // At most one word without digits, and only as the prefix.
  if (words.slice(1).some((word) => !hasDigit(word))) return 0;
  if (words.some((word) => !hasDigit(word) && !isPrefix(word))) return 0;
  if (words.length === 1 && /^(19|20)\d\d$/.test(text)) return 0; // a year on its own
  if (/^\d{8,}$/.test(compact(text))) return 0; // a barcode, not a catalogue number
  const mixed = /[A-Z]/.test(text) && hasDigit(text);
  return 1 + (mixed ? 4 : 0) + (/^[A-Z]/.test(text) ? 1 : 0) + length / 100;
}

/**
 * Suggestions read from the OCR text of the camera frame.
 * @param {string} text - raw OCR text (one or more lines)
 * @returns {{ catalogNumbers: string[], barcode: string }}
 *   catalogNumbers: best first; a spaced number is followed by its compact
 *   form (“PGLP 21”, “PGLP21”), since sources write it either way;
 *   barcode: a 12/13-digit code with a valid check digit, if the frame holds one.
 */
export function extractCatalogNumbers(text) {
  const lines = String(text ?? '').split(/\n+/).map(cleanLine).filter(Boolean);

  let barcode = '';
  for (const match of String(text ?? '').matchAll(/\d[\d -]{9,20}\d/g)) {
    const digits = match[0].replace(/\D/g, '');
    if ((digits.length === 12 || digits.length === 13) && isValidBarcode(digits)) {
      barcode = digits;
      break;
    }
  }

  const candidates = [];
  for (const line of lines) {
    const words = line.split(' ').map((word) => word.replace(/^[./-]+|[./-]+$/g, '')).filter(Boolean);
    for (let start = 0; start < words.length; start += 1) {
      for (let end = start + 1; end <= Math.min(words.length, start + 4); end += 1) {
        const run = words.slice(start, end);
        const value = score(run);
        if (value > 0) candidates.push({ text: run.join(' '), value });
      }
    }
  }
  candidates.sort((a, b) => b.value - a.value);

  const suggestions = [];
  const seen = new Set();
  const offer = (value) => {
    if (!seen.has(value) && suggestions.length < MAX_SUGGESTIONS) {
      seen.add(value);
      suggestions.push(value);
    }
  };
  for (const { text: candidate } of candidates) {
    if (!seen.has(candidate) && [...seen].some((known) => compact(known).includes(compact(candidate)))) {
      continue; // same number already offered in another spelling, or part of a better one (“1355” in “CL 1355”)
    }
    offer(candidate);
    if (candidate.includes(' ') || /[./-]/.test(candidate)) offer(compact(candidate));
  }
  return { catalogNumbers: suggestions, barcode };
}
