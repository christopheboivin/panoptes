/**
 * Camera: opens the rear camera in a <video> element, and real-time barcode
 * scanning on top of it (see ocr-scan.js for catalogue numbers).
 */

import { SCAN_INTERVAL_MS } from '../config.js';
import { detectBarcode, getDetector } from './barcode-engine.js';

function cameraErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError': return 'Camera access denied. Allow it in the browser settings.';
    case 'NotFoundError': return 'No camera found on this device.';
    case 'NotReadableError': return 'The camera is already in use by another application.';
    default: return `Camera unavailable: ${error?.message ?? error}`;
  }
}

/**
 * Opens the rear camera and shows it in the given <video> element.
 * @param {HTMLVideoElement} video
 * @param {MediaTrackConstraints} [constraints] - added to the default ones (e.g. a higher resolution)
 * @returns {Promise<() => void>} stop function, to be called in every case (several calls are harmless)
 */
export async function openCamera(video, constraints = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot use the camera (an HTTPS address is required).');
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, ...constraints },
      audio: false,
    });
  } catch (error) {
    throw new Error(cameraErrorMessage(error));
  }

  const stop = () => {
    stream.getTracks().forEach((track) => track.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };

  video.srcObject = stream;
  try {
    await video.play();
  } catch (error) {
    stop(); // do not leave the camera on
    throw new Error(`Cannot display the camera: ${error?.message ?? error}`);
  }
  return stop;
}

/**
 * Starts barcode scanning in the given <video> element.
 * @param {HTMLVideoElement} video
 * @param {(code: string) => void} onCode - called once, with the first code read
 * @returns {Promise<() => void>} stop function (to be called in every case)
 */
export async function startLiveScan(video, onCode) {
  await getDetector(); // fails early if no reader is available
  const closeCamera = await openCamera(video);

  let active = true;
  let timer = null;

  const stop = () => {
    active = false;
    clearTimeout(timer);
    closeCamera();
  };

  const tick = async () => {
    if (!active) return;
    try {
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        const code = await detectBarcode(video);
        if (code && active) {
          stop();
          onCode(code);
          return;
        }
      }
    } catch {
      // An unreadable frame is not an error: move on to the next one.
    }
    timer = setTimeout(tick, SCAN_INTERVAL_MS);
  };

  tick();
  return stop;
}
