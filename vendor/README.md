# Third-party libraries hosted in the repository

Copied as is from the official npm packages, without any change, so that the page loads
no script or file from a third-party server (CDN).

| File | npm package | Version | Licence | SHA-256 |
|---|---|---|---|---|
| `barcode-detector/pure.js` | [barcode-detector](https://github.com/Sec-ant/barcode-detector) (`dist/es/pure.js`) | 2.2.5 | MIT | `04848f0eab84367c92c05a172008dc59c738f832a22152eb0aa494d939092268` |
| `zxing-wasm/zxing_reader.wasm` | [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (`dist/reader/zxing_reader.wasm`) | 1.2.7 | MIT (engine [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp): Apache 2.0) | `72a4a47d6faf4f6ba7d643403196a62b4b4ba6d66e945813a54914de98d4415a` |

The `.wasm` file must match **exactly** the zxing-wasm version expected by barcode-detector
(the `dependencies` field of its `package.json`). barcode-detector 2.2.5 expects zxing-wasm 1.2.7.

The location of these files is declared in `js/config.js`; `js/scanner/barcode-engine.js` tells
barcode-detector where to find the `.wasm` file (`setZXingModuleOverrides`).

## Updating

```sh
npm pack barcode-detector@<version>       # then read the zxing-wasm version it expects
npm pack zxing-wasm@<expected version>
```

Extract the archives (`tar -xzf …`), copy the two files and the `LICENSE` files again, update this table
(`sha256sum`), then test a scan in Firefox.
