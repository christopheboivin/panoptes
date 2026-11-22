/**
 * Lecture de codes-barres sur une image ou une vidéo.
 *
 * Utilise le lecteur intégré au navigateur s'il existe (Chrome sur Android),
 * sinon charge à la demande un équivalent (barcode-detector, basé sur ZXing).
 * Firefox n'ayant pas de lecteur intégré, il passe toujours par ce second chemin.
 * Les deux exposent la même interface standard : detector.detect(source).
 */

import { BARCODE_FORMATS, BARCODE_POLYFILL_URL, ZXING_WASM_URL } from '../config.js';

let detectorPromise = null;

async function createDetector() {
  const Native = globalThis.BarcodeDetector;
  if (Native) {
    const supported = await Native.getSupportedFormats();
    const formats = BARCODE_FORMATS.filter((format) => supported.includes(format));
    if (formats.length > 0) return new Native({ formats });
  }
  const { BarcodeDetector, setZXingModuleOverrides } = await import(BARCODE_POLYFILL_URL);
  // Par défaut, la bibliothèque télécharge son fichier .wasm sur jsDelivr :
  // on lui indique la copie hébergée dans le dépôt.
  setZXingModuleOverrides({
    locateFile: (path, prefix) => (path.endsWith('.wasm') ? ZXING_WASM_URL : prefix + path),
  });
  return new BarcodeDetector({ formats: BARCODE_FORMATS });
}

/** Renvoie le lecteur (créé une seule fois, recréé si sa création a échoué). */
export function getDetector() {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((error) => {
      detectorPromise = null;
      throw new Error(`Lecteur de codes-barres indisponible : ${error.message}`);
    });
  }
  return detectorPromise;
}

/**
 * Cherche un code-barres dans une source (vidéo, image, ImageBitmap…).
 * @returns {Promise<string|null>} le premier code trouvé, ou null
 */
export async function detectBarcode(source) {
  const detector = await getDetector();
  const results = await detector.detect(source);
  return results[0]?.rawValue ?? null;
}

/** Cherche un code-barres sur une photo (fichier image). */
export async function readBarcodeFromImage(image) {
  const bitmap = await createImageBitmap(image);
  try {
    return await detectBarcode(bitmap);
  } finally {
    bitmap.close();
  }
}
