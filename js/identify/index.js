/**
 * Identification visuelle d'un disque à partir d'une photo, utilisée quand
 * aucun code-barres n'y a été lu (la lecture du code-barres, elle, passe par
 * scanner/ puis par une confirmation de l'utilisateur).
 *
 * Les identificateurs sont essayés dans l'ordre ; le premier qui trouve des
 * candidats l'emporte. Pour ajouter le scan visuel de pochette, créer
 * js/identify/cover.js respectant le contrat ci-dessous et l'ajouter à la liste.
 *
 * Contrat d'un identificateur :
 *   { id: string, label: string,
 *     identify(image: Blob) -> Promise<{ candidates: Candidate[], detail: string }> }
 */

const IDENTIFIERS = [
  // coverIdentifier, // à venir : reconnaissance visuelle de la pochette
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
