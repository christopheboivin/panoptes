# Bibliothèques tierces hébergées dans le dépôt

Copiées telles quelles depuis les paquets npm officiels, sans modification, pour que la page
ne charge aucun script ni fichier depuis un serveur tiers (CDN).

| Fichier | Paquet npm | Version | Licence | SHA-256 |
|---|---|---|---|---|
| `barcode-detector/pure.js` | [barcode-detector](https://github.com/Sec-ant/barcode-detector) (`dist/es/pure.js`) | 2.2.5 | MIT | `04848f0eab84367c92c05a172008dc59c738f832a22152eb0aa494d939092268` |
| `zxing-wasm/zxing_reader.wasm` | [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (`dist/reader/zxing_reader.wasm`) | 1.2.7 | MIT (moteur [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp) : Apache 2.0) | `72a4a47d6faf4f6ba7d643403196a62b4b4ba6d66e945813a54914de98d4415a` |

Le fichier `.wasm` doit correspondre **exactement** à la version de zxing-wasm attendue par barcode-detector
(champ `dependencies` de son `package.json`). barcode-detector 2.2.5 attend zxing-wasm 1.2.7.

L'emplacement de ces fichiers est déclaré dans `js/config.js` ; `js/scanner/barcode-engine.js` indique
à barcode-detector où trouver le `.wasm` (`setZXingModuleOverrides`).

## Mettre à jour

```sh
npm pack barcode-detector@<version>       # puis lire la version de zxing-wasm attendue
npm pack zxing-wasm@<version attendue>
```

Extraire les archives (`tar -xzf …`), recopier les deux fichiers et les `LICENSE`, mettre à jour ce tableau
(`sha256sum`), puis tester un scan dans Firefox.
