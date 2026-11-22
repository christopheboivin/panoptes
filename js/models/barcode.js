/**
 * Record barcodes (EAN-8, UPC-A, EAN-13): clean-up and validation.
 * The last digit is a check digit; a wrong check digit indicates a
 * misread or mistyped code.
 */

const VALID_LENGTHS = new Set([8, 12, 13]);

/** Keeps digits only. */
export function normalizeBarcode(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Single form of a code for comparisons: a UPC-A (12 digits) is the same
 * code as the EAN-13 made of a 0 followed by those 12 digits.
 */
export function canonicalBarcode(value) {
  const digits = normalizeBarcode(value);
  return digits.length === 12 ? `0${digits}` : digits;
}

/** True if the code has a known length and a correct check digit. */
export function isValidBarcode(value) {
  const digits = normalizeBarcode(value);
  if (!VALID_LENGTHS.has(digits.length)) return false;
  const body = digits.slice(0, -1);
  let sum = 0;
  // Alternating weights 3 and 1, starting from the rightmost digit of the body.
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}
