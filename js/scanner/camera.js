/**
 * Scan en temps réel : caméra arrière ouverte, analyse régulière des images
 * jusqu'à la détection d'un code-barres.
 */

import { SCAN_INTERVAL_MS } from '../config.js';
import { detectBarcode, getDetector } from './barcode-engine.js';

function cameraErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError': return "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur.";
    case 'NotFoundError': return 'Aucune caméra détectée sur cet appareil.';
    case 'NotReadableError': return 'La caméra est déjà utilisée par une autre application.';
    default: return `Caméra indisponible : ${error?.message ?? error}`;
  }
}

/**
 * Démarre le scan dans l'élément <video> fourni.
 * @param {HTMLVideoElement} video
 * @param {(code: string) => void} onCode - appelé une fois, au premier code lu
 * @returns {Promise<() => void>} fonction d'arrêt (à appeler dans tous les cas)
 */
export async function startLiveScan(video, onCode) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Ce navigateur ne permet pas d\'utiliser la caméra (une adresse HTTPS est nécessaire).');
  }
  await getDetector(); // échoue tôt si aucun lecteur n'est disponible

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
      // Une image illisible n'est pas une erreur : on passe à la suivante.
    }
    timer = setTimeout(tick, SCAN_INTERVAL_MS);
  };

  video.srcObject = stream;
  await video.play();
  tick();
  return stop;
}
