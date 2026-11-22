/**
 * Text recognition (OCR) of catalogue numbers, with Tesseract.js hosted in
 * vendor/ and loaded on first use (about 7 MB the first time; the language
 * data is then kept by Tesseract in IndexedDB).
 *
 * A single recognition engine (a Web Worker) is kept while it is needed and
 * released by releaseOcr(): it uses around 100 MB of memory, a lot on a phone.
 *
 *   readText(image) -> Promise<{ text, confidence }>
 *     image: canvas, ImageBitmap, image element or Blob
 */

import {
  TESSERACT_URL, TESSERACT_WORKER_URL, TESSERACT_CORE_URL, TESSERACT_LANG_URL, CATNO_CHARACTERS,
} from '../config.js';

let workerPromise = null;
let progressListener = null;

/**
 * Follows the loading of the engine: listener(status, progress 0..1), e.g.
 * ('loading language traineddata', 0.4). Pass null to stop.
 */
export function onOcrProgress(listener) {
  progressListener = listener;
}

async function createOcrWorker() {
  // The ESM build only has a default export.
  const { createWorker, OEM, PSM } = (await import(TESSERACT_URL)).default;
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: TESSERACT_WORKER_URL,
    corePath: TESSERACT_CORE_URL,
    langPath: TESSERACT_LANG_URL,
    logger: ({ status, progress }) => {
      if (progressListener && typeof progress === 'number') progressListener(status, progress);
    },
  });
  await worker.setParameters({
    tessedit_char_whitelist: CATNO_CHARACTERS,
    // The camera frame holds a single line of text.
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    preserve_interword_spaces: '1',
  });
  return worker;
}

/** Returns the engine (created once, re-created if creation failed). */
export function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = createOcrWorker().catch((error) => {
      workerPromise = null;
      throw new Error(`Text reader unavailable: ${error?.message ?? error}`);
    });
  }
  return workerPromise;
}

/** Reads the text of an image (one line, catalogue-number characters only). */
export async function readText(image) {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(image);
  return { text: data.text ?? '', confidence: data.confidence ?? 0 };
}

/** Releases the engine and its memory; the next readText() creates it again. */
export async function releaseOcr() {
  const pending = workerPromise;
  workerPromise = null;
  const worker = await pending?.catch(() => null);
  await worker?.terminate();
}
