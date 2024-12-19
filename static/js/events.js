import { getMousePosition, getHandleAtPoint } from "./utils.js";
import { handleDragging, isPointInEllipse } from "./utils.js";
import { redrawCanvas } from "./drawing.js";
import { saveAnnotations, updateAnnotations, openImageForAnnotation } from "./annotation_api.js";
import { toggleMode } from "./modes.js";
import { currentMode, setMode } from "./main.js";
import { SERVER_URL } from "./constants.js";

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Event Listeners
canvas.addEventListener('mousedown', (e) => {
  if (currentMode === 'segmentation' && currentShape) {
    const { x, y } = getMousePosition(e);
    const handleIndex = getHandleAtPoint(x, y);
    if (handleIndex !== -1) {
      isDraggingHandle = true;
      draggedHandleIndex = handleIndex;
    }
  }
});

canvas.addEventListener('mouseup', (e) => {
  isDraggingHandle = false;
  draggedHandleIndex = -1;
});

canvas.addEventListener('mousemove', (e) => {
  const cursorPosition = document.getElementById('cursorPosition');
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (mouseX >= xStart && mouseX <= xStart + renderableWidth &&
      mouseY >= yStart && mouseY <= yStart + renderableHeight) {

    const imageX = (mouseX - xStart) / renderableWidth;
    const imageY = (mouseY - yStart) / renderableHeight;
    cursorPosition.textContent = `Cursor: (x: ${imageX.toFixed(6)}, y: ${imageY.toFixed(6)})`;

    redrawCanvas();

    // Draw crosshairs
    ctx.strokeStyle = 'green';
    ctx.beginPath();
    ctx.moveTo(mouseX, yStart);
    ctx.lineTo(mouseX, yStart + renderableHeight);
    ctx.moveTo(xStart, mouseY);
    ctx.lineTo(xStart + renderableWidth, mouseY);
    ctx.stroke();

    if (currentMode === 'segmentation') {
      if (isDraggingHandle && currentShape) {
        const { x, y } = getMousePosition(e);
        handleDragging(x, y);
        redrawCanvas();
      } else if (drawingStarted) {
        // Drawing ellipse
        endX = mouseX;
        endY = mouseY;
        const rectStartX = Math.max(xStart, Math.min(startX, endX));
        const rectStartY = Math.max(yStart, Math.min(startY, endY));
        const rectEndX = Math.min(xStart + renderableWidth, Math.max(startX, endX));
        const rectEndY = Math.min(yStart + renderableHeight, Math.max(startY, endY));

        const rectWidth = rectEndX - rectStartX;
        const rectHeight = rectEndY - rectStartY;
        const centerX = (rectStartX + rectEndX) / 2;
        const centerY = (rectStartY + rectEndY) / 2;

        ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
        ctx.strokeStyle = 'blue';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, rectWidth / 2, rectHeight / 2, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    } else if (currentMode === 'detection') {
      if (drawingStarted) {
        // Drawing rectangle
        const rectStartX = Math.max(xStart, Math.min(startX, mouseX));
        const rectStartY = Math.max(yStart, Math.min(startY, mouseY));
        const rectEndX = Math.min(xStart + renderableWidth, Math.max(startX, mouseX));
        const rectEndY = Math.min(yStart + renderableHeight, Math.max(startY, mouseY));

        const rectWidth = rectEndX - rectStartX;
        const rectHeight = rectEndY - rectStartY;

        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.strokeStyle = 'orange';
        ctx.fillRect(rectStartX, rectStartY, rectWidth, rectHeight);
        ctx.strokeRect(rectStartX, rectStartY, rectWidth, rectHeight);
      }
    }

  } else {
    cursorPosition.textContent = 'Cursor: outside image';
    redrawCanvas();
  }
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (mouseX >= xStart && mouseX <= xStart + renderableWidth &&
      mouseY >= yStart && mouseY <= yStart + renderableHeight) {

    if (currentMode === 'segmentation') {
      if (currentShape && !drawingStarted) {
        const { x, y } = getMousePosition(e);
        if (isPointInEllipse(x, y, currentShape)) {
          // Toggle rotate mode
          isRotationMode = !isRotationMode;
          redrawCanvas();
        }
      } else if (!drawingStarted && !currentShape) {
        // Start drawing ellipse
        startX = mouseX;
        startY = mouseY;
        drawingStarted = true;
      } else if (drawingStarted && !currentShape) {
        // Finish ellipse
        endX = mouseX;
        endY = mouseY;
        drawingStarted = false;

        const rectStartX = Math.max(xStart, Math.min(startX, endX));
        const rectStartY = Math.max(yStart, Math.min(startY, endY));
        const rectEndX = Math.min(xStart + renderableWidth, Math.max(startX, endX));
        const rectEndY = Math.min(yStart + renderableHeight, Math.max(startY, endY));

        const boxStartX = (rectStartX - xStart) / renderableWidth;
        const boxStartY = (rectStartY - yStart) / renderableHeight;
        const boxEndX = (rectEndX - xStart) / renderableWidth;
        const boxEndY = (rectEndY - yStart) / renderableHeight;

        const boxCenterX = (boxStartX + boxEndX) / 2;
        const boxCenterY = (boxStartY + boxEndY) / 2;
        const boxWidth = boxEndX - boxStartX;
        const boxHeight = boxEndY - boxStartY;

        currentShape = {
          type: 'ellipse',
          classId: 0,
          centerX: boxCenterX,
          centerY: boxCenterY,
          width: boxWidth,
          height: boxHeight,
          rotation: 0
        };
        isRotationMode = false;
        redrawCanvas();
      }
    } else if (currentMode === 'detection') {
      if (!drawingStarted) {
        // Start rectangle
        startX = mouseX;
        startY = mouseY;
        drawingStarted = true;
      } else {
        // Finish rectangle
        endX = mouseX;
        endY = mouseY;
        drawingStarted = false;

        const xMin = Math.max(xStart, Math.min(startX, endX));
        const yMin = Math.max(yStart, Math.min(startY, endY));
        const xMax = Math.min(xStart + renderableWidth, Math.max(startX, endX));
        const yMax = Math.min(yStart + renderableHeight, Math.max(startY, endY));

        const boxStartX = (xMin - xStart) / renderableWidth;
        const boxStartY = (yMin - yStart) / renderableHeight;
        const boxEndX = (xMax - xStart) / renderableWidth;
        const boxEndY = (yMax - yStart) / renderableHeight;

        const boxCenterX = (boxStartX + boxEndX) / 2;
        const boxCenterY = (boxStartY + boxEndY) / 2;
        const boxWidth = boxEndX - boxStartX;
        const boxHeight = boxEndY - boxStartY;

        shapes.push({
          type: 'rectangle',
          classId: 0,
          centerX: boxCenterX,
          centerY: boxCenterY,
          width: boxWidth,
          height: boxHeight
        });
        updateAnnotations();
      }
    }
  }
});

window.openAnnotationFile = function(filename) {
  if (filename.endsWith('.txt')) {
    // Load detection
    fetch(`${SERVER_URL}/annotations/${filename}`)
      .then(response => response.text())
      .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        shapes = lines.map(line => {
          const [classId, centerX, centerY, width, height] = line.split(' ').map(Number);
          return { classId, type:'rectangle', centerX, centerY, width, height };
        });
        setMode('detection');
        updateAnnotations();
      })
      .catch(error => console.error('Error fetching annotation file:', error));
  } else if (filename.endsWith('.json')) {
    // Load segmentation
    fetch(`${SERVER_URL}/annotations/${filename}`)
      .then(response => response.json())
      .then(data => {
        const imageId = currentImageIndex + 1;
        const imageAnnotations = data.annotations.filter(ann => ann.image_id === imageId);

        shapes = imageAnnotations.map(ann => {
          const segmentation = ann.segmentation[0];
          const [xMin, yMin, w, h] = ann.bbox;
          const centerX = xMin + w / 2;
          const centerY = yMin + h / 2;
          const normCenterX = centerX / image.width;
          const normCenterY = centerY / image.height;
          const normWidth = w / image.width;
          const normHeight = h / image.height;

          return {
            classId: ann.category_id,
            type: 'ellipse',
            centerX: normCenterX,
            centerY: normCenterY,
            width: normWidth,
            height: normHeight,
            polygon: segmentation
          };
        });
        setMode('segmentation');
        updateAnnotations();
      })
      .catch(error => console.error('Error fetching annotation file:', error));
  }
}

window.openNextImage = function() {
  if (currentImageIndex < imageFiles.length - 1) {
    const nextIndex = currentImageIndex + 1;
    const fileList = document.getElementById('file-list');
    const fileItems = fileList.querySelectorAll('.filename');
    const nextFileItem = fileItems[nextIndex];
    openImageForAnnotation(nextIndex, nextFileItem);
  } else {
    alert('No more images.');
  }
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drawingStarted) {
    drawingStarted = false;
    redrawCanvas();
  }
  if (e.key === 's') {
    saveAnnotations();
  }
  if (e.key === 'n') {
    openNextImage();
  }
  if (e.key === 'm') {
    saveAnnotations();
    openNextImage();
  }
  if (e.key === 'e') {
    toggleMode();
  }
  if (e.key === 'd' && currentShape) {
    shapes.push({ ...currentShape });
    currentShape = null;
    redrawCanvas();
    updateAnnotations();
  }
});
