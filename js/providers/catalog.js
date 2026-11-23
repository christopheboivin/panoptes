/**
 * Catalogue: queries every configured data source at once (MusicBrainz,
 * Discogs) and joins their results, in the order of the sources. No source
 * is complete on its own: Discogs lists far more vinyl than MusicBrainz.
 *
 * A source (see musicbrainz.js, discogs.js) exposes:
 *   { id, name, isConfigured(), searchByBarcode(code), searchByText(criteria), listEditions(album)? }
 *
 * The editions of an album are asked of the source that found the album
 * (its identifiers mean nothing to the others).
 *
 * Search result: { candidates, providerName, skipped, errors, failed }
 *   - providerName: names of the sources that found something, e.g. 'MusicBrainz and Discogs' (empty if none);
 *   - skipped: names of the sources that are not configured (e.g. Discogs without a token);
 *   - errors: errors from failing sources, when another source could answer;
 *   - failed: names of those failing sources.
 * If no source finds anything and at least one failed, the first error is
 * thrown: the user must know that the search is incomplete.
 */

export function createCatalog(providers) {
  async function run(method, query) {
    const configured = providers.filter((provider) => provider.isConfigured());
    const skipped = providers.filter((provider) => !configured.includes(provider)).map((provider) => provider.name);
    const settled = await Promise.allSettled(configured.map((provider) => provider[method](query)));

    const candidates = [];
    const answered = [];
    const errors = [];
    const failed = [];
    settled.forEach((outcome, index) => {
      const { name } = configured[index];
      if (outcome.status === 'rejected') {
        errors.push(outcome.reason);
        failed.push(name);
      } else if (outcome.value.length > 0) {
        candidates.push(...outcome.value);
        answered.push(name);
      }
    });
    if (candidates.length === 0 && errors.length > 0) throw errors[0];
    return { candidates, providerName: answered.join(' and '), skipped, errors, failed };
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
