window.currentMode = 'detection';

window.toggleMode = function() {
  if (currentMode === 'detection') {
    currentMode = 'segmentation';
    alert('Switched to segmentation mode');
  } else {
    currentMode = 'detection';
    alert('Switched to detection mode');
  }

  window.shapes = [];
  annotations.textContent = '';
  redrawCanvas();

  if (currentImageIndex !== -1) {
    openImageForAnnotation(currentImageIndex, selectedImageElement);
  }
}
