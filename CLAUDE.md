# Panoptes: instructions for AI agents

A personal library of vinyl records and CDs (barcode scanning, Collection, Wishlist).
Static web app in plain JavaScript ES modules, hosted on GitHub Pages.
Read `NOTES.md` for the current state and next steps; `README.md` for features and architecture.

## Working rules

- **Present the plan and wait for the user's confirmation before changing code.**
- **Git: the user commits and pushes.** Prepare the files and propose a commit message; do not commit or push.
  Commit messages end with a `Co-Authored-By: Claude …` line.
- Keep the user informed of progress, briefly.
- Everything is in **English**: UI text, messages, comments, tests, docs.

## Hard constraints

- **No framework, no build step, no runtime dependency.** The browser loads the files as they are in the repo.
  Development-only tools are acceptable if they never ship to the browser.
- **No third-party script or CDN at runtime**: it would be able to read the Discogs token from localStorage.
  Third-party code goes in `vendor/` (see `vendor/README.md`, update `vendor/SHA256SUMS` too).
- **Target browser: Firefox** (desktop and Android). Chrome must work. Safari/iOS is not supported.
- The Discogs token stays in localStorage: never exported, never logged, never committed, sent only to Discogs.
- Never commit `panoptes-export-*.json` (personal library backups).
- Changing the record shape or the export format: keep `schemaVersion` compatibility (`js/storage/library.js`)
  and existing IndexedDB data readable.
- Any external data rendered as HTML goes through `escapeHtml()` (`js/ui/render.js`).

## Commands

```sh
node --test                  # unit tests (Node.js >= 20, no dependencies)
deno test --allow-all tests/ # same tests with Deno (installed on the user's PC; Node is not)
uv run --no-project python -m http.server 8080 --bind 127.0.0.1   # local server, then http://localhost:8080
sha256sum -c vendor/SHA256SUMS   # check the hosted libraries
```

On the user's Windows machine, Python comes from uv: there is no `py`, `python` or `python3` command
(use `uv run --no-project python …`). Node.js may be missing: say so instead of guessing test results.
Camera scanning cannot be tested by an agent: use the checklist in `TESTING.md` and ask the user.

## Code map

- `js/main.js`: screen state and event wiring only; business logic lives elsewhere.
- `js/models/`: record shape (`createRecord`, `validateRecord`, `toAlbum`), barcode validation, and
  `match.js` (same edition / same album, graded SAME or PROBABLE). Pure.
  A Collection record is one physical copy; a Wishlist record is an album (no edition details).
  Duplicates are allowed and only pointed out, never blocked.
- `js/storage/`: `db.js` (the only IndexedDB code), `library.js` (business rules, export/import), `settings.js` (token).
- `js/providers/`: data sources. Contract: `{ id, name, isConfigured, searchByBarcode, searchByText }`
  returning Candidates `{ title, artist, year, format, label, catno, barcode, country, source: { provider, id, groupId }, coverUrls }`
  (`id`: edition, `groupId`: album, both specific to that source). `catalog.js` queries them in order
  (MusicBrainz first) and stops at the first with results. `throttle.js` spaces out requests.
- `js/scanner/`: barcode reading (native `BarcodeDetector`, else `vendor/barcode-detector`) and live camera scan.
- `js/identify/`: extension point for recognising a cover from a photo (planned: OCR in `cover.js`).
- `js/ui/render.js`: pure HTML generation.
- `tests/`: `node:test` unit tests; inject fakes (storage, `fetchFn`) rather than touching the network.

## Conventions

- 2-space indentation, single quotes, semicolons, ES modules with explicit `.js` extensions.
- Keep pure functions (normalisation, validation, rendering) separate from I/O so they can be tested.
- New modules get a header comment stating their role and contract.
- Add or update tests with every change to `models/`, `storage/` or `providers/`.
- Do not read `vendor/barcode-detector/pure.js` or the `.wasm` file: generated third-party code.
- Bump `APP_VERSION` in `js/config.js` and `version` in `package.json` together, and update `CHANGELOG.md`.
