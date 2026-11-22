/**
 * Visual identification of a record from a photo, used when no barcode could
 * be read on it (barcode reading itself goes through scanner/, then through
 * a confirmation by the user).
 *
 * Identifiers are tried in order; the first one that finds candidates wins.
 * To add visual cover scanning, create js/identify/cover.js following the
 * contract below and add it to the list.
 *
 * Identifier contract:
 *   { id: string, label: string,
 *     identify(image: Blob) -> Promise<{ candidates: Candidate[], detail: string }> }
 */

const IDENTIFIERS = [
  // coverIdentifier, // to come: visual recognition of the cover
];

export function hasImageIdentifiers() {
  return IDENTIFIERS.length > 0;
}

export async function identifyImage(image) {
  const details = [];
  for (const identifier of IDENTIFIERS) {
    const { candidates, detail } = await identifier.identify(image);
    if (candidates.length > 0) {
      return { candidates, detail };
    }
    details.push(detail);
  }
  return { candidates: [], detail: details.join(' ') };
}
