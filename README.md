# Panoptes

A personal library for vinyl records and CDs: barcode scanning, a collection and a wishlist.
Static web application written in plain JavaScript (ES modules): no framework, no build step.

**Live app: <https://christopheboivin.github.io/panoptes/>**

Target browser: **Firefox** (desktop and Android). Chrome also works; Safari/iPhone is not supported.

## Features

- Real-time barcode scanning with the camera (**Barcode**), or from a photo (**Photo**). The scanned code is displayed together with the result of its check-digit validation; nothing is looked up until the user confirms.
- **Catalogue-number reading** with the camera (**Cat. no.**), for records without a barcode: fit the number printed on the back cover or the spine (**↻ Spine**) in the frame and tap it among the suggestions. Text recognition runs on the phone (Tesseract.js, about 7 MB downloaded the first time); nothing is looked up until the user confirms.
- Manual search by barcode, artist, title or catalogue number (e.g. PGLP21, useful for older records without a barcode).
- Two data sources, queried in order: [MusicBrainz](https://musicbrainz.org), then [Discogs](https://www.discogs.com) if MusicBrainz finds nothing (Discogs has far better coverage of vinyl). The source of each result is shown.
- If no source knows the barcode, search by artist, title or catalogue number instead: the scanned code is then saved with the record you pick.
- Two lists: **Collection** (one entry per physical copy, with its edition: country, label, catalogue number…) and **Wishlist** (albums, whatever the edition).
- **Edition picker**: “Which edition do you own?” lists every edition of an album, filterable by format, country and text (label, catalogue number, year), to compare with the record in hand; essential for records without a barcode. Opened by **I own it…** (artist/title search results are grouped by album), **Got it** on a wishlist album, or **Other editions…** after a barcode search.
- Several copies of an edition, and several editions of an album, are allowed: search results and cards only point them out (“In your collection (1 copy)”, “You own another edition of this album”, “On your wishlist”).
- Data from MusicBrainz and Discogs; cover art from [Cover Art Archive](https://coverartarchive.org) and Discogs.
- Local storage in the browser (IndexedDB), with **JSON export/import** for backups and for moving data between devices.

## Enabling Discogs

Discogs search requires a free personal access token:

1. Sign in to Discogs, open <https://www.discogs.com/settings/developers> and click “Generate new token”.
2. In Panoptes, open **Settings**, paste the token and save.

The token is kept in the browser's localStorage on each device. It is **never** included in the JSON export or in the repository, and it is only ever sent to Discogs (over HTTPS). It grants access to your Discogs account: if in doubt, regenerate it on the same page. Without a token, only MusicBrainz is queried.

On GitHub Pages, all projects of the same account share the `<account>.github.io` origin, and therefore the same localStorage: only publish trusted code there, or use a custom domain.

## Running locally

Any Python 3 will do; the simplest is [uv](https://docs.astral.sh/uv/), which works the same on every system:

```sh
uv run --no-project python -m http.server 8080 --bind 127.0.0.1   # with uv (Windows, Linux, macOS)
python3 -m http.server 8080 --bind 127.0.0.1                      # with a system Python (Linux / macOS)
```

On Windows without uv, `python` may open the Microsoft Store instead of Python: this is a system shortcut. Use the official launcher (`py -m http.server 8080 --bind 127.0.0.1`), or disable the shortcut in *Settings > Apps > Advanced app settings > App execution aliases*.

Then open <http://localhost:8080>. The camera works on `localhost`; anywhere else, an **HTTPS** address is required (GitHub Pages is fine).

Unit tests (Node.js 20 or later, no dependencies):

```sh
npm test
```

## Publishing on GitHub Pages

1. Push the repository to GitHub.
2. *Settings → Pages*: source “Deploy from a branch”, branch `main`, folder `/ (root)`.
3. The site is published at `https://<account>.github.io/panoptes/` (the `.nojekyll` file disables Jekyll processing).

The repository only contains the code. Your library stays in each device's browser: **remember to export it regularly**.

## Architecture

```
index.html, css/style.css
js/
  main.js                   Screen state and event handling (no business logic)
  config.js                 Centralised settings
  models/record.js          Shape of a record, validation
  models/barcode.js         Barcode clean-up and check-digit validation
  models/match.js           Same edition? same album? (hints only, never blocks)
  models/editions.js        Results grouped by album; sorting and filters of the edition picker
  storage/db.js             IndexedDB access (the only module that knows about it)
  storage/library.js        Business rules: add, change status, export/import
  storage/settings.js       Per-device settings (Discogs token), never exported
  providers/catalog.js      Queries the sources in order, stops at the first result
  providers/throttle.js     Minimum delay between two requests to a source
  providers/musicbrainz.js  MusicBrainz source: search and normalisation
  providers/discogs.js      Discogs source (personal token required)
  identify/index.js         Registry of visual identifiers (photo without a barcode)
  models/catno.js           Catalogue-number suggestions from OCR text
  scanner/barcode-engine.js Barcode reading (native or fallback library)
  scanner/camera.js         Camera opening; real-time barcode scanning
  scanner/ocr-engine.js     Text recognition (Tesseract.js, loaded on first use)
  scanner/ocr-scan.js       Real-time catalogue-number reading inside the frame
  scanner/frame.js          On-screen frame → camera pixels
  ui/render.js              HTML generation (with escaping)
vendor/                     Hosted third-party libraries (see vendor/README.md)
tests/                      Unit tests (node --test)
```

### Extension points

- **Visual cover scanning**: create `js/identify/cover.js` following the contract described in `js/identify/index.js`, then add it to the `IDENTIFIERS` list. The **From a photo** button will use it automatically when no barcode can be read.
- **Another data source**: create a module in `js/providers/` exposing `{ id, name, isConfigured, searchByBarcode, searchByText }` and returning candidates in the same format, then add it to the list passed to `createCatalog()` in `main.js` (the order of the list is the query order).
- **Sync between devices**: provide a storage module exposing `getAll`, `put`, `putMany` and `remove`, and pass it to `createLibrary()` in `main.js`.

## External dependencies

- [barcode-detector](https://github.com/Sec-ant/barcode-detector) (MIT, based on ZXing), loaded only when the browser has no built-in barcode reader. **Firefox (the target browser) has none**, so this library is essential there.
- [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache 2.0), text recognition for catalogue numbers, loaded only when **Cat. no.** is used.

Both are **hosted in the repository** (`vendor/`), with their WebAssembly engines and data: the page loads no script or file from any third-party server, which in particular protects the Discogs token. Versions, licences, checksums and update procedure: see [`vendor/README.md`](vendor/README.md).

## Licence

Panoptes is released under the [MIT licence](LICENSE). The libraries in `vendor/` keep their own licences (see [`vendor/README.md`](vendor/README.md)).

## Export format

```json
{ "app": "panoptes", "schemaVersion": 1, "exportedAt": "…", "records": [ … ] }
```

Import merges: a record that already exists (same identifier) is replaced; the others are added.
