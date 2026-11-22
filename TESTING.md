# Manual test checklist

What the unit tests (`node --test`) cannot cover: camera, real browsers, real APIs.
Run it on the live site (<https://christopheboivin.github.io/panoptes/>) before each release,
and note the date, browser and device in `NOTES.md`.

## Each browser: Firefox desktop, Firefox Android, Chrome Android

- [ ] The page loads with no error in the console (F12).
- [ ] Network tab: no request to a CDN (jsdelivr.net, unpkg.com…). Only musicbrainz.org, api.discogs.com,
      coverartarchive.org / archive.org and i.discogs.com. Also after using **Cat. no.** (Tesseract).
- [ ] **Barcode**: the camera opens (rear camera on a phone), reads an EAN-13 barcode, shows “check digit OK”,
      and searches nothing until “Search” is pressed.
- [ ] **Stop** and closing the dialog turn the camera off (the browser's camera indicator disappears).
- [ ] Closing the dialog while the camera permission prompt is still open: the camera does not stay on.
- [ ] **From a photo**: a photo of a barcode fills in the code; a photo without one shows a clear message.

## Catalogue-number reading (on the phone, Firefox and Chrome)

- [ ] First use: “Preparing the text reader… %” then the camera; second use (even offline): immediate.
- [ ] Back cover (printed straight): the number appears as a suggestion within a few seconds.
- [ ] Spine: **↻ Spine** turns the frame vertical; spines read top-to-bottom and bottom-to-top both work.
- [ ] CD: back insert, spine.
- [ ] Vinyl centre label (small or curved print): note what works and what does not.
- [ ] Low light, glossy sleeve, slightly tilted record.
- [ ] Words around the number (“STEREO”, label name) are not offered.
- [ ] A barcode inside the frame is offered as **Barcode …**.
- [ ] Tapping a suggestion stops the camera, fills **Catalogue number**, searches nothing before **Search**.
- [ ] **I own it…** then opens the picker already filtered on that number.
- [ ] **Stop** and closing the dialog turn the camera off; the phone stays responsive (memory released).
- [ ] For each record tried, note: where the number is, read or not, time taken, wrong characters (O/0, I/1…).

## Search and library (one browser is enough)

- [ ] Barcode known to MusicBrainz (e.g. a mainstream CD): results “on MusicBrainz”, covers shown.
- [ ] Barcode only on Discogs (e.g. 884108013632, Peter Gabriel *i/o* vinyl): results “on Discogs” with a token,
      tip about Discogs without one.
- [ ] Catalogue number search (e.g. PGLP21).
- [ ] Unknown barcode, then search by artist/title: the scanned code is saved with the chosen record.
- [ ] Add to Collection, add to Wishlist, “Got it”, Remove; the counters update.
- [ ] A result already in the library shows “In your collection (1 copy)” and offers “+ Another copy”.
- [ ] Artist + title search: results grouped by album; **I own it…** opens the edition picker.

## Edition picker (on the phone)

- [ ] Editions appear as they load (“Loading editions… 100 so far”); a large album (e.g. *Kind of Blue*) stays usable.
- [ ] Album, question and filters stay at the top while scrolling the list.
- [ ] Format and Country filters, and the text filter (e.g. a catalogue number typed without spaces).
- [ ] **This one** adds the edition; the row then shows “In your collection” and “Another copy”.
- [ ] **← Back** returns to the results at the same scroll position.
- [ ] **Got it** on a wishlist album opens the picker; choosing an edition asks to remove the album from the wishlist.
- [ ] Barcode search, then **Other editions…**: the scanned code is saved with the edition chosen.
- [ ] With a Discogs token: an album found on Discogs lists its versions (no barcode shown: Discogs does not give it there).
- [ ] Export, then Import of the same file on another browser: same records, token not included in the file.

## Settings

- [ ] Saving a Discogs token, reopening Settings: the token is not displayed again.
- [ ] Wrong token: clear “Discogs rejects the saved token” message.
- [ ] Delete token: only MusicBrainz is searched.
