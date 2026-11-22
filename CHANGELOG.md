# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow `APP_VERSION` in `js/config.js`.

## [Unreleased]

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
