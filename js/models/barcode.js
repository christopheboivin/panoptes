/**
 * Codes-barres des disques (EAN-8, UPC-A, EAN-13) : nettoyage et contrôle.
 * Le dernier chiffre est une clé de contrôle ; une clé fausse signale une
 * lecture ou une saisie erronée.
 */

const VALID_LENGTHS = new Set([8, 12, 13]);

/** Ne garde que les chiffres. */
export function normalizeBarcode(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** Vrai si le code a une longueur connue et une clé de contrôle correcte. */
export function isValidBarcode(value) {
  const digits = normalizeBarcode(value);
  if (!VALID_LENGTHS.has(digits.length)) return false;
  const body = digits.slice(0, -1);
  let sum = 0;
  // Poids 3 et 1 en alternance, en partant du chiffre le plus à droite du corps.
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}
