/**
 * Catalogue: queries every configured data source in provider order.
 *
 * A source (see musicbrainz.js, discogs.js) exposes:
 *   { id, name, isConfigured(), searchByBarcode(code), searchByText(criteria), listEditions(album)? }
 *
 * The editions of an album are asked of the source that found the album
 * (its identifiers mean nothing to the others).
 *
 * Search result: { candidates, providerName, skipped, errors }
 *   - providerName: names of sources that answered (empty if none);
 *   - skipped: names of sources that are not configured (e.g. Discogs without a token);
 *   - errors: errors from failing sources, even when another source could answer.
 * If no source finds anything and at least one failed, the first error is
 * thrown: the user must know that the search is incomplete.
 */

export function createCatalog(providers) {
  async function run(method, query) {
    const candidates = [];
    const answered = [];
    const skipped = [];
    const errors = [];

    for (const provider of providers) {
      if (!provider.isConfigured()) {
        skipped.push(provider.name);
        continue;
      }
      try {
        const found = await provider[method](query);
        if (found.length > 0) {
          candidates.push(...found);
          answered.push(provider.name);
        }
      } catch (error) {
        errors.push(error);
      }
    }

    if (candidates.length === 0 && errors.length > 0) throw errors[0];
    return {
      candidates,
      providerName: answered.join(' + '),
      skipped,
      errors,
    };
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

    /** Editions of an album, page by page (AsyncGenerator<Candidate[]>). */
    listEditions: (album) => sourceOf(album).listEditions(album),
  };
}
