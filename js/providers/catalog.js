/**
 * Catalogue: queries the data sources in order and stops at the first one
 * that finds something (MusicBrainz, then Discogs).
 *
 * A source (see musicbrainz.js, discogs.js) exposes:
 *   { id, name, isConfigured(), searchByBarcode(code), searchByText(criteria), listEditions(album)? }
 *
 * The editions of an album are asked of the source that found the album
 * (its identifiers mean nothing to the others).
 *
 * Search result: { candidates, providerName, skipped, errors }
 *   - providerName: name of the source that answered (empty if none);
 *   - skipped: names of the sources that are not configured (e.g. Discogs without a token);
 *   - errors: errors from failing sources, when another source could answer.
 * If no source finds anything and at least one failed, the first error is
 * thrown: the user must know that the search is incomplete.
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

  function sourceOf(album) {
    return providers.find((provider) => provider.id === album.source?.provider) ?? null;
  }

  return {
    searchByBarcode: (code) => run('searchByBarcode', code),
    searchByText: (criteria) => run('searchByText', criteria),

    /** Can the editions of this album be listed (known source, album identifier)? */
    canListEditions: (album) => Boolean(album.source?.groupId && sourceOf(album)?.listEditions),

    /** Name of the source of an album or record (e.g. 'MusicBrainz'), empty if unknown. */
    sourceName: (album) => sourceOf(album)?.name ?? '',

    /**
     * Editions of an album, page by page (AsyncGenerator<Candidate[]>).
     * Check canListEditions() first.
     */
    listEditions: (album) => sourceOf(album).listEditions(album),
  };
}
