# Third-party libraries hosted in the repository

Copied as is from the official npm packages, without any change, so that the page loads
no script or file from a third-party server (CDN).

| File | npm package | Version | Licence | SHA-256 |
|---|---|---|---|---|
| `barcode-detector/pure.js` | [barcode-detector](https://github.com/Sec-ant/barcode-detector) (`dist/es/pure.js`) | 2.2.5 | MIT | `04848f0eab84367c92c05a172008dc59c738f832a22152eb0aa494d939092268` |
| `zxing-wasm/zxing_reader.wasm` | [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (`dist/reader/zxing_reader.wasm`) | 1.2.7 | MIT (engine [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp): Apache 2.0) | `72a4a47d6faf4f6ba7d643403196a62b4b4ba6d66e945813a54914de98d4415a` |
| `tesseract/tesseract.esm.min.js` | [tesseract.js](https://github.com/naptha/tesseract.js) (`dist/tesseract.esm.min.js`) | 7.0.0 | Apache 2.0 | `64871d76c75609fd5413b88a8171e2ef40deedd77d5875ba23df104b2d05eb29` |
| `tesseract/worker.min.js` | tesseract.js (`dist/worker.min.js`) | 7.0.0 | Apache 2.0 | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` |
| `tesseract/tesseract-core-simd-lstm.wasm.js` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 7.0.0 | Apache 2.0 | `c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38` |
| `tesseract/eng.traineddata.gz` | [@tesseract.js-data/eng](https://www.npmjs.com/package/@tesseract.js-data/eng) (`4.0.0_best_int/`) | 1.0.0 | MIT (package); data from [tessdata_best](https://github.com/tesseract-ocr/tessdata_best), Apache 2.0 | `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91` |

The `.wasm` file must match **exactly** the zxing-wasm version expected by barcode-detector
(the `dependencies` field of its `package.json`). barcode-detector 2.2.5 expects zxing-wasm 1.2.7.

The location of these files is declared in `js/config.js`; `js/scanner/barcode-engine.js` tells
barcode-detector where to find the `.wasm` file (`setZXingModuleOverrides`).

Tesseract (text recognition of catalogue numbers, `js/scanner/ocr-engine.js`):

- Only the **SIMD + LSTM** build of the engine is hosted (supported by Firefox and Chrome on Android since 2021).
  `js/config.js` gives Tesseract the exact file, so it never chooses another build nor uses its CDN.
- The engine version must match the one expected by tesseract.js (`dependencies` of its `package.json`):
  tesseract.js 7.0.0 expects tesseract.js-core ^7.0.0.
- About 7 MB, downloaded by the phone the first time OCR is used; Tesseract then keeps the language data
  in IndexedDB.

## Updating

```sh
npm pack barcode-detector@<version>       # then read the zxing-wasm version it expects
npm pack zxing-wasm@<expected version>
```

Extract the archives (`tar -xzf …`), copy the two files and the `LICENSE` files again, update this table
and `SHA256SUMS` (`sha256sum`), then test a scan in Firefox.

```sh
npm pack tesseract.js@<version>                # then read the tesseract.js-core version it expects
npm pack tesseract.js-core@<expected version>
npm pack @tesseract.js-data/eng
```

Copy `dist/tesseract.esm.min.js`, `dist/worker.min.js`, `tesseract-core-simd-lstm.wasm.js`,
`4.0.0_best_int/eng.traineddata.gz` and the licences, update this table and `SHA256SUMS`,
then test a catalogue-number scan in Firefox.

`SHA256SUMS` is checked by CI on every push (`sha256sum -c vendor/SHA256SUMS`).
