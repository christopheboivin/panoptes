# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow `APP_VERSION` in `js/config.js`.

## [Unreleased]

## [0.6.0] - 2026-11-22

### Changed
- Collection and Wishlist are grouped by artist (“The” ignored for sorting), records by year then title.
  Groups are folded by default and show up to two covers as a preview; tapping an artist unfolds it, and the
  heading stays at the top while scrolling its records. While filtering, every matching group is unfolded.
- Export, Import, Settings and the version number moved from the page footer to a **⋯** menu in the header.

## [0.5.1] - 2026-11-22

### Fixed
- Long catalogue numbers read by OCR (e.g. “7243 8 57826 2 7”, 16 digits) were dropped or cut into fragments.
  The suggestion rules now follow the MusicBrainz description of a catalogue number (letters followed by numbers,
  no length limit, digits-only allowed unless it is a valid barcode, Label Codes excluded) and keep the number
  whole, a single misread letter between digit groups included.

### Changed
- OCR suggestions accumulate instead of being replaced at each reading: they keep their place, the one read
  most often is highlighted, and a **Clear** button starts over. Suggestions are offered as printed (no more
  compact variant).

## [0.5.0] - 2026-11-22

### Added
- **Catalogue-number reading with the camera (OCR)**: the new **Cat. no.** button reads the text inside a wide
  frame about once a second and offers the catalogue numbers found as large buttons; **↻ Spine** turns the frame
  vertical for spines. The number chosen goes into its field, then nothing is searched before **Search**; a valid
  barcode inside the frame is offered as a barcode. Runs entirely on the phone with Tesseract.js 7.0.0, hosted in
  `vendor/tesseract/` (about 7 MB, downloaded the first time only).
- After a catalogue-number search, **I own it…** opens the edition picker already filtered on that number.
- `models/catno.js` (suggestions from OCR text) and `scanner/frame.js` (frame geometry), with tests.

### Changed
- The add buttons are now **Barcode**, **Cat. no.** and **Photo**.
- `scanner/camera.js`: opening the camera (`openCamera`) is shared by the barcode and catalogue-number readings.
- The edition picker says when its filters leave no edition.

## [0.4.0] - 2026-11-22

### Added
- **Edition picker**, designed for a phone screen: “Which edition do you own?” lists every edition of an album
  (MusicBrainz release group, Discogs master), loaded page by page, with Format and Country filters and a text
  filter (label, catalogue number, year). Album, question and filters stay visible while the list scrolls.
- Text search results are grouped by album (“I own it…” opens the picker); barcode results offer “Other editions…”.
- `listEditions()` in both sources; MusicBrainz is now created by `createMusicBrainzProvider()` (testable, like Discogs).
- Recorded MusicBrainz and Discogs responses in `tests/fixtures/`.
- Records keep the album identifier of their source (`source.groupId`: MusicBrainz release group, Discogs master).
- Search results and cards point out copies of the same edition, other editions of the same album and albums on
  the wishlist (`models/match.js`: same identifier, barcode, label + catalogue number, or artist + title).
- Adding an edition of a wanted album asks whether to remove the album from the wishlist.

### Changed
- Several copies of the same edition can now be added (“+ Another copy”); duplicates are pointed out, never blocked.
- The wishlist holds albums: adding to it drops the edition details of the result that was clicked.
- “Got it” on a wishlist album opens the edition picker, so the edition actually owned is recorded.
- Searches ask for 50 results instead of 15, since results are grouped by album.
- Discogs label names lose their “(2)” namesake suffix.

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
