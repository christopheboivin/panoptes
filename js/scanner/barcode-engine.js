/**
 * Barcode reading from an image or a video.
 *
 * Uses the browser's built-in reader when there is one (Chrome on Android),
 * otherwise loads an equivalent on demand (barcode-detector, based on ZXing).
 * Firefox has no built-in reader, so it always takes this second path.
 * Both expose the same standard interface: detector.detect(source).
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
  // By default the library downloads its .wasm file from jsDelivr:
  // point it to the copy hosted in the repository.
  setZXingModuleOverrides({
    locateFile: (path, prefix) => (path.endsWith('.wasm') ? ZXING_WASM_URL : prefix + path),
  });
  return new BarcodeDetector({ formats: BARCODE_FORMATS });
}

/** Returns the reader (created once, re-created if creation failed). */
export function getDetector() {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((error) => {
      detectorPromise = null;
      throw new Error(`Barcode reader unavailable: ${error.message}`);
    });
  }
  return detectorPromise;
}

/**
 * Looks for a barcode in a source (video, image, ImageBitmap…).
 * @returns {Promise<string|null>} the first code found, or null
 */
export async function detectBarcode(source) {
  const detector = await getDetector();
  const results = await detector.detect(source);
  return results[0]?.rawValue ?? null;
}

/** Looks for a barcode on a photo (image file). */
export async function readBarcodeFromImage(image) {
  const bitmap = await createImageBitmap(image);
  try {
    return await detectBarcode(bitmap);
  } finally {
    bitmap.close();
  }
}
