# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow `APP_VERSION` in `js/config.js`.

## [Unreleased]

### Added
- Records keep the album identifier of their source (`source.groupId`: MusicBrainz release group, Discogs master).
- Search results and cards point out copies of the same edition, other editions of the same album and albums on
  the wishlist (`models/match.js`: same identifier, barcode, label + catalogue number, or artist + title).
- Adding an edition of a wanted album asks whether to remove the album from the wishlist.

### Changed
- Several copies of the same edition can now be added (“+ Another copy”); duplicates are pointed out, never blocked.
- The wishlist holds albums: adding to it drops the edition details of the result that was clicked.
- “Got it” on a wishlist album searches its editions, so the edition actually owned is recorded.

## [0.3.0] - 2026-11-22

### Fixed
- The camera no longer stays on when the Add dialog is closed while the camera is starting
  (permission prompt still open), or when the video cannot be displayed.
- Adding a record, “Got it” and “Remove” now show an error message instead of failing silently.
- The results of an older search no longer overwrite those of a newer one (or a new scan).
- MusicBrainz and Discogs requests started at the same time are now properly spaced out
  (shared `providers/throttle.js`).

### Changed
- Whole project translated into English: interface, messages, comments, tests and documentation.
  IndexedDB data, export format and Discogs token storage are unchanged.

### Added
- Files for AI agents and tooling: `CLAUDE.md`, `.claude/`, `jsconfig.json`, `.editorconfig`, `.gitattributes`,
  `.nvmrc`, `TESTING.md`, this changelog.
- CI (GitHub Actions): unit tests, `vendor/` checksums, version numbers in sync.

## [0.2.0] - 2026-11-22

### Added
- Discogs as a second data source, queried only when MusicBrainz finds nothing (personal token required).
- Search by catalogue number (MusicBrainz `catno:` and Discogs).
- Settings dialog for the Discogs token (stored in localStorage, never exported).
- Source shown under each search result.

### Changed
- barcode-detector 2.2.5 and zxing-wasm 1.2.7 are hosted in `vendor/`: no more requests to jsDelivr.

## [0.1.0]

### Added
- Barcode scanning with the camera or from a photo, with check-digit validation and confirmation before searching.
- Search on MusicBrainz by barcode (UPC-A and EAN-13 forms) or by artist/title, covers from Cover Art Archive.
- Collection and Wishlist, “Got it” button, local storage (IndexedDB), versioned JSON export/import.
- Automatic retry when MusicBrainz rate-limits requests (HTTP 503).
