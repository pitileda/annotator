import { redrawCanvas } from "./drawing.js";
import { openImageForAnnotation } from "./annotation_api.js";
import { currentMode, setMode } from "./main.js";

export function toggleMode() {
  if (currentMode === 'detection') {
    setMode('segmentation');
    alert('Switched to segmentation mode');
  } else {
    setMode('detection');
    alert('Switched to detection mode');
  }

  window.shapes = [];
  annotations.textContent = '';
  redrawCanvas();

  if (currentImageIndex !== -1) {
    openImageForAnnotation(currentImageIndex, selectedImageElement);
  }
}
