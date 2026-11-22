/**
 * Real-time scanning: opens the rear camera and analyses frames regularly
 * until a barcode is detected.
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
 * Starts scanning in the given <video> element.
 * @param {HTMLVideoElement} video
 * @param {(code: string) => void} onCode - called once, with the first code read
 * @returns {Promise<() => void>} stop function (to be called in every case)
 */
export async function startLiveScan(video, onCode) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot use the camera (an HTTPS address is required).');
  }
  await getDetector(); // fails early if no reader is available

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (error) {
    throw new Error(cameraErrorMessage(error));
  }

  let active = true;
  let timer = null;

  const stop = () => {
    active = false;
    clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
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

  video.srcObject = stream;
  try {
    await video.play();
  } catch (error) {
    stop(); // do not leave the camera on
    throw new Error(`Cannot display the camera: ${error?.message ?? error}`);
  }
  tick();
  return stop;
}
