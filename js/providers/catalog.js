/**
 * Catalogue : interroge les sources de données dans l'ordre, et s'arrête à
 * la première qui trouve quelque chose (MusicBrainz, puis Discogs).
 *
 * Une source (voir musicbrainz.js, discogs.js) expose :
 *   { id, name, isConfigured(), searchByBarcode(code), searchByText(criteria) }
 *
 * Résultat d'une recherche : { candidates, providerName, skipped, errors }
 *   - providerName : nom de la source qui a répondu (vide si aucune) ;
 *   - skipped : noms des sources non configurées (ex. Discogs sans jeton) ;
 *   - errors : erreurs des sources en échec, quand une autre a pu répondre.
 * Si aucune source ne trouve rien et qu'au moins une a échoué, la première
 * erreur est levée : l'utilisateur doit savoir que la recherche est incomplète.
 */

export function createCatalog(providers) {
  async function run(method, query) {
    const skipped = [];
    const errors = [];
    for (const provider of providers) {
      if (!provider.isConfigured()) {
        skipped.push(provider.name);
        continue;
      }
      try {
        const candidates = await provider[method](query);
        if (candidates.length > 0) {
          return { candidates, providerName: provider.name, skipped, errors };
        }
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) throw errors[0];
    return { candidates: [], providerName: '', skipped, errors };
  }

  return {
    searchByBarcode: (code) => run('searchByBarcode', code),
    searchByText: (criteria) => run('searchByText', criteria),
  };
}
