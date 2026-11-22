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
- **MusicBrainz stays the first source** (open data), Discogs second (decided 22 November 2026). The local
  database is the truth for the collection: records are snapshots, never refreshed from the sources.
- **Uniqueness** (decided 22 November 2026):
  - A Collection record is **one physical copy** of an edition. Several copies and several editions are allowed;
    the app only points them out (“+ Another copy”, “You own another edition”), it never blocks.
  - A Wishlist record is an **album**, whatever the edition (no edition details).
  - `source = { provider, id, groupId }`: edition and album identifiers **of that source only**
    (MusicBrainz release / release group, Discogs release / master). Across sources, matching uses the barcode,
    then label + catalogue number (edition), and artist + title (album), shown as “maybe”.
  - Adding an edition of a wanted album **asks** whether to remove it from the Wishlist.
  - `schemaVersion` stays 1 (`groupId` is optional; no older app version is in use).
  - Later: per-copy details (condition, purchase date, price, notes), “group by album” view.

## Current state (v0.5.0)

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
- 75 unit tests (`npm test` with Node.js, or `deno test --allow-all tests/`: Deno is installed on the PC, Node is not).
- Whole project translated into English (interface, messages, comments, tests, documentation) on 22 November 2026;
  the IndexedDB data, the export format and the Discogs token storage are unchanged.
- **v0.3.0** (22 November 2026): camera always released (dialog closed during start-up, video error),
  error messages on add / “Got it” / remove, stale search results ignored, shared request throttle
  (`providers/throttle.js`). See `CHANGELOG.md`.
- **v0.4.0** (22 November 2026):
  - Phase A: copies / editions / albums (see Decisions), `models/match.js`, Wishlist stored as albums.
  - Phase B: **edition picker** for a phone screen (`models/editions.js`, `listEditions()` in both sources,
    sticky filters Format / Country / text); text search grouped by album (“I own it…”); “Got it” and
    barcode “Other editions…” open the picker. Checked in the preview at 375 px against the real MusicBrainz.
  - Not checked in a browser: the Discogs picker (no token in the preview; covered by unit tests on recorded
    responses). Discogs versions carry no barcode.
- **v0.5.0** (22 November 2026): **catalogue-number OCR, step 1** (an extra mode, barcode scan unchanged).
  - Tesseract.js 7.0.0 hosted in `vendor/tesseract/` (SIMD + LSTM engine only, English data `4.0.0_best_int`,
    about 7 MB downloaded once); `scanner/ocr-engine.js`, `scanner/ocr-scan.js`, `scanner/frame.js`, `models/catno.js`.
  - “Cat. no.” button: wide frame (vertical with “↻ Spine”, both reading directions tried), only the framed area
    is read (~1 per second), suggestions as large buttons; a valid barcode in the frame is offered as a barcode.
    The chosen number goes into its field, nothing is searched before “Search”; “I own it…” then opens the picker
    filtered on that number.
  - Checked in the preview at 375 px with a simulated camera (drawn images): back cover and spine read correctly,
    decoy words outside the frame ignored, no CDN request, picker narrowed from 138 to 4 editions on “CL 1355”.
  - **Not checked**: a real camera and real records. That is the purpose of step 1.
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

1. **User tests the catalogue-number OCR on 15–20 real records** (see `TESTING.md`, “Catalogue-number
   reading”): back covers, spines, CDs, vinyl labels, low light. Then decide:
2. **OCR step 2** (if reliable enough): OCR becomes the default way to add; the barcode scan moves to a small
   camera icon inside the Barcode field (an icon rather than “on tap”, so the field can still be typed in).
   Possible adjustments depending on the results: frame size, suggestion rules, image processing.
3. **Test on the live site**: v0.4.0 edition picker (including an album found on Discogs), scanning in Firefox
   on desktop and Android, and check (F12, Network tab) that no request goes to jsdelivr.net.
   On each new device, re-enter the Discogs token and import an export if needed.
   Tesseract.js can be fetched via npm (reachable from Claude's workspace).

## Environment and conventions

Working rules, constraints and commands for AI agents are in [`CLAUDE.md`](CLAUDE.md) (loaded automatically by Claude Code).

- Terminal: Git Bash. Tests run locally with Deno (Node.js is not installed); CI runs them with Node on every push.
- Permissions on the PC (especially deletion) are requested for the project folder only, never for its parent folder.
  To do so, connect `panoptes` itself to the conversation rather than its parent.
