# Manual test checklist

What the unit tests (`node --test`) cannot cover: camera, real browsers, real APIs.
Run it on the live site (<https://christopheboivin.github.io/panoptes/>) before each release,
and note the date, browser and device in `NOTES.md`.

## Each browser: Firefox desktop, Firefox Android, Chrome Android

- [ ] The page loads with no error in the console (F12).
- [ ] Network tab: no request to a CDN (jsdelivr.net, unpkg.com…). Only musicbrainz.org, api.discogs.com,
      coverartarchive.org / archive.org and i.discogs.com.
- [ ] **Scan**: the camera opens (rear camera on a phone), reads an EAN-13 barcode, shows “check digit OK”,
      and searches nothing until “Search” is pressed.
- [ ] **Stop** and closing the dialog turn the camera off (the browser's camera indicator disappears).
- [ ] Closing the dialog while the camera permission prompt is still open: the camera does not stay on.
- [ ] **From a photo**: a photo of a barcode fills in the code; a photo without one shows a clear message.

## Search and library (one browser is enough)

- [ ] Barcode known to MusicBrainz (e.g. a mainstream CD): results “on MusicBrainz”, covers shown.
- [ ] Barcode only on Discogs (e.g. 884108013632, Peter Gabriel *i/o* vinyl): results “on Discogs” with a token,
      tip about Discogs without one.
- [ ] Catalogue number search (e.g. PGLP21).
- [ ] Unknown barcode, then search by artist/title: the scanned code is saved with the chosen record.
- [ ] Add to Collection, add to Wishlist, “Got it”, Remove; the counters update.
- [ ] A result already in the library shows “Already in your collection/wishlist”.
- [ ] Export, then Import of the same file on another browser: same records, token not included in the file.

## Settings

- [ ] Saving a Discogs token, reopening Settings: the token is not displayed again.
- [ ] Wrong token: clear “Discogs rejects the saved token” message.
- [ ] Delete token: only MusicBrainz is searched.
