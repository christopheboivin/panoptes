/**
 * Real-time catalogue-number reading: opens the rear camera and reads the
 * text inside the on-screen frame about once a second, until stopped.
 *
 * Only the framed area is read: cropped from the camera image, turned
 * horizontal for a spine, resized for OCR and converted to greyscale. A
 * spine's text can run either way, so in vertical mode the readings
 * alternate between the two rotations.
 */

import { OCR_INTERVAL_MS } from '../config.js';
import { openCamera } from './camera.js';
import { getOcrWorker, readText } from './ocr-engine.js';
import { frameToVideoRect, ocrImageSize } from './frame.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Draws the framed area of the current video image into the canvas, ready for OCR.
 * @param {number} rotation - 0 (horizontal), 90 or -90 degrees
 * @returns {HTMLCanvasElement|null} null if the frame is empty
 */
function captureFrame(video, { box, frame }, rotation, canvas) {
  const crop = frameToVideoRect({ width: video.videoWidth, height: video.videoHeight }, box, frame);
  if (crop.width === 0 || crop.height === 0) return null;
  const turned = rotation === 0 ? crop : { width: crop.height, height: crop.width };
  const size = ocrImageSize(turned);
  const scale = size.width / turned.width;
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  context.filter = 'grayscale(1) contrast(1.3)';
  if (rotation === 90) {
    context.translate(size.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === -90) {
    context.translate(0, size.height);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width * scale, crop.height * scale);
  return canvas;
}

/**
 * Starts reading catalogue numbers in the given <video> element.
 * The text reader is loaded first (a download the first time), then the camera opens.
 * @param {HTMLVideoElement} video
 * @param {object} options
 * @param {() => {box: {width, height}, frame: {x, y, width, height}, vertical: boolean}} options.getFrame
 *   on-screen frame, in pixels of the video box, read before each reading (it can change)
 * @param {(reading: {text: string, confidence: number}) => void} options.onRead - called after each reading
 * @returns {Promise<() => void>} stop function (to be called in every case)
 */
export async function startLiveOcr(video, { getFrame, onRead }) {
  await getOcrWorker();
  // Small print needs detail: ask for a high resolution, and continuous focus where supported.
  const closeCamera = await openCamera(video, {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: [{ focusMode: 'continuous' }],
  });

  let active = true;
  const canvas = document.createElement('canvas');

  (async () => {
    let flip = false;
    while (active) {
      const started = Date.now();
      try {
        const geometry = getFrame();
        if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
          flip = !flip;
          const rotation = geometry.vertical ? (flip ? 90 : -90) : 0;
          const image = captureFrame(video, geometry, rotation, canvas);
          if (image) {
            const reading = await readText(image);
            if (active) onRead(reading);
          }
        }
      } catch {
        // An unreadable image is not an error: move on to the next one.
      }
      await sleep(Math.max(100, OCR_INTERVAL_MS - (Date.now() - started)));
    }
  })();

  return () => {
    active = false;
    closeCamera();
  };
}
