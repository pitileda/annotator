// Global variables
window.canvas = document.getElementById('canvas');
window.ctx = canvas.getContext('2d');
window.annotations = document.getElementById('annotations');
window.fileList = document.getElementById('file-list');
window.txtFileList = document.getElementById('txt-file-list');
window.uploadFolder = document.getElementById('upload-folder');
window.cursorPosition = document.getElementById('cursorPosition');

window.image = new Image();
window.xStart = 0; 
window.yStart = 0; 
window.renderableWidth = 0; 
window.renderableHeight = 0;

window.startX = 0; 
window.startY = 0; 
window.endX = 0; 
window.endY = 0;
window.drawingStarted = false;
window.imageFiles = [];
window.currentImageFilename = '';
window.selectedImageElement = null;
window.currentImageIndex = -1;
window.shapes = [];
window.currentShape = null;
window.isDraggingHandle = false;
window.draggedHandle = null;
window.draggedHandleIndex = -1;
window.isRotationMode = false;

window.addEventListener('load', () => {
  resizeCanvas();
  displayTxtFileNames();
});

window.addEventListener('resize', resizeCanvas);

uploadFolder.addEventListener('change', (e) => {
  const allFiles = Array.from(e.target.files);
  imageFiles = allFiles.filter(file => file.type.startsWith('image/'));
  displayFileNames();
});

window.displayFileNames = function() {
  fileList.innerHTML = '<h3>Image Files</h3>';
  fileList.appendChild(uploadFolder);

  imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  imageFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.classList.add('filename');
    fileItem.textContent = file.name;
    fileItem.addEventListener('click', () => openImageForAnnotation(index, fileItem));
    fileList.appendChild(fileItem);
  });
}
