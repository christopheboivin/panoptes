/**
 * Geometry of the OCR camera frame. Pure functions.
 *
 * The video fills its box with object-fit: cover, so part of the camera image
 * is cut off on screen: the frame drawn on screen must be converted into
 * camera pixels before cropping the image.
 */

/**
 * Converts a rectangle of the on-screen box into camera pixels.
 * @param {{width: number, height: number}} videoSize - camera image (videoWidth, videoHeight)
 * @param {{width: number, height: number}} boxSize - displayed video box
 * @param {{x: number, y: number, width: number, height: number}} frame - rectangle in box pixels
 * @returns {{x: number, y: number, width: number, height: number}} whole camera pixels, inside the image
 */
export function frameToVideoRect(videoSize, boxSize, frame) {
  const scale = Math.max(boxSize.width / videoSize.width, boxSize.height / videoSize.height);
  const offsetX = (videoSize.width * scale - boxSize.width) / 2;
  const offsetY = (videoSize.height * scale - boxSize.height) / 2;
  const left = Math.max(0, Math.round((frame.x + offsetX) / scale));
  const top = Math.max(0, Math.round((frame.y + offsetY) / scale));
  const right = Math.min(videoSize.width, Math.round((frame.x + frame.width + offsetX) / scale));
  const bottom = Math.min(videoSize.height, Math.round((frame.y + frame.height + offsetY) / scale));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * Size of the image given to OCR: text is read best when its height is about
 * 30–60 px, so small crops are enlarged and large ones reduced.
 * @param {{width: number, height: number}} crop - cropped area (after rotation)
 * @param {number} [targetHeight]
 */
export function ocrImageSize(crop, targetHeight = 120) {
  if (crop.width === 0 || crop.height === 0) return { width: 0, height: 0 };
  const scale = Math.min(4, Math.max(0.5, targetHeight / crop.height));
  return { width: Math.round(crop.width * scale), height: Math.round(crop.height * scale) };
}
