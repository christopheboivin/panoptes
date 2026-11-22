# Handover notes — Panoptes

Handover file between conversations with Claude. Read this first when resuming the project.
Last updated: 22 November 2026.

## Goal

A personal web application to catalogue a collection of vinyl records and CDs: scanning, a library
(“Collection”) and a list of wanted records (“Wishlist”). Free and open-source software wherever possible.

## Decisions

- **Target browser: Firefox** (desktop and Android). Chrome must work; Safari/iPhone is not supported.
- **Simple, maintainable code**: plain JavaScript ES modules, no framework and no build step,
  good practices, no throwaway prototype. Extensible architecture (see README).
- **Local storage** in the browser (IndexedDB) + **JSON export/import** (versioned format, merge by identifier).
  Sync between devices (a server such as PocketBase) may come later, through another storage module.
- **Real-time camera scanning**, plus a “From a photo” button.
- **Confirmation before searching**: the scanned code is shown with its check-digit result; nothing is looked up until the user confirms.
- **Hosting: GitHub Pages** (HTTPS is required for the camera). The repository only contains the code, never the library.
- **Everything in English**: user interface, messages, code comments, tests and documentation (decided 22 November 2026).

## Current state (v0.3.0)

- **Live at <https://christopheboivin.github.io/panoptes/>**, repository <https://github.com/christopheboivin/panoptes>
  (public, MIT licence, first commit `522cde0`).
- Working and tested against the real MusicBrainz: search by barcode (UPC-A and EAN-13 forms),
  by artist/title, add to Collection or Wishlist, “Got it” button, export/import.
- Automatic retry when MusicBrainz temporarily refuses requests (HTTP 503, rate limit of about 1 request/s).
- If a barcode is unknown, the app suggests searching by artist/title/catalogue number
  and saves the scanned code with the chosen record.
- **v0.2.0**: Discogs as a second source (queried only when MusicBrainz finds nothing, via `providers/catalog.js`),
  search by catalogue number (MusicBrainz `catno:` and Discogs), “Settings” dialog for the Discogs token,
  source shown under each result.
- **Discogs tested and validated in Firefox** by the user (22 November 2026): barcode and catalogue number.
- barcode-detector 2.2.5 and its zxing_reader.wasm file (zxing-wasm 1.2.7) are **hosted in `vendor/`**:
  no more requests to jsDelivr. Loading of the .wasm file checked under Node.
- 34 unit tests (`npm test`, Node.js, no dependencies).
- Whole project translated into English (interface, messages, comments, tests, documentation) on 22 November 2026;
  the IndexedDB data, the export format and the Discogs token storage are unchanged.
- **v0.3.0** (22 November 2026): camera always released (dialog closed during start-up, video error),
  error messages on add / “Got it” / remove, stale search results ignored, shared request throttle
  (`providers/throttle.js`). See `CHANGELOG.md`.
- **Not yet tested**: camera scanning and “from a photo” with the hosted library, in Firefox on desktop and on Android.

## Discogs token (decided 22 November 2026)

- Entered in the app (Settings), stored in each device's localStorage, never exported nor committed,
  sent only to Discogs as the `token` query parameter (no custom header, so no CORS preflight request).
- This is also the chosen approach for GitHub Pages (a static site has nowhere to hide a secret;
  a relay server was ruled out as contrary to the KISS principle).
- Precautions: barcode-detector is hosted in the repository, so no third-party script can read the token;
  all `<account>.github.io` projects share the same localStorage.

## Key finding

MusicBrainz has poor coverage of barcodes for recent vinyl releases. Example: Peter Gabriel, *i/o*,
barcode 884108013632, missing from MusicBrainz; the vinyl editions (PGLP21, PGLPX21) have no barcode there.
Discogs finds them.

## Next steps, in order

1. **Test on the live site**: scanning in Firefox on desktop and Android (camera over HTTPS, hosted
   barcode-detector), and check (F12, Network tab) that no request goes to jsdelivr.net.
   On each new device, re-enter the Discogs token and import an export if needed.
2. **Cover OCR** with Tesseract.js (Apache 2.0, runs in the browser), aimed mainly at the back cover, the spine
   or the centre label to read the catalogue number and the label. To be plugged into `js/identify/cover.js`.
   Tesseract.js can be fetched via npm (reachable from Claude's workspace).

## Environment and conventions

Working rules, constraints and commands for AI agents are in [`CLAUDE.md`](CLAUDE.md) (loaded automatically by Claude Code).

- Terminal: Git Bash. Node.js must be installed to run the tests locally (CI runs them on every push).
- Permissions on the PC (especially deletion) are requested for the project folder only, never for its parent folder.
  To do so, connect `panoptes` itself to the conversation rather than its parent.
