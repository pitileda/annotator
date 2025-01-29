import { getMousePosition, getEllipseHandleAtPoint } from "./utils.js";
import { handleDraggingEllipse, isPointInEllipse } from "./utils.js";
import { redrawCanvas } from "./drawing.js";
import { saveAnnotations, updateAnnotations, openImageForAnnotation, openAnnotationFile } from "./annotation_api.js";
import { toggleMode } from "./modes.js";
import { currentMode } from "./main.js";
import { identityMatrix, multiply, translate, scale } from "./matrix.js";

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Event Listeners
canvas.addEventListener('mousedown', (e) => {
  if (currentMode === 'segmentation' && currentShape && currentShape.type === 'ellipse') {
    const { x, y } = getMousePosition(e);
    // Use new ellipse handle detection
    const handleIndex = getEllipseHandleAtPoint(x, y, currentShape);
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
  // console.log("[DEBUG] mousemove. drawingStarted=", 
  //   drawingStarted, " currentShape=", currentShape);
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
      if (isDraggingHandle && currentShape && currentShape.type === 'ellipse') {
        const { x, y } = getMousePosition(e);
        handleDraggingEllipse(x, y, draggedHandleIndex, currentShape);
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
  console.log("[DEBUG] canvas.click triggered");
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  console.log("[DEBUG] mouseX=", mouseX, " mouseY=", mouseY);

  if (mouseX >= xStart && mouseX <= xStart + renderableWidth &&
      mouseY >= yStart && mouseY <= yStart + renderableHeight) {

    if (currentMode === 'segmentation') {
      // console.log("[DEBUG] segmentation mode click. drawingStarted=", 
      //   drawingStarted, " currentShape=", currentShape);
      if (currentShape && !drawingStarted) {
        const { x, y } = getMousePosition(e);
        if (isPointInEllipse(x, y, currentShape)) {
          // Toggle rotate mode
          isRotationMode = !isRotationMode;
          redrawCanvas();
        }
      } else if (!drawingStarted && !currentShape) {
        // Start drawing ellipse
        console.log("[DEBUG] Starting ellipse: set drawingStarted=true");
        startX = mouseX;
        startY = mouseY;
        drawingStarted = true;
      } else if (drawingStarted && !currentShape) {
        // Finish ellipse
        console.log("[DEBUG] Finishing ellipse. Will create transformMatrix shape.");
        endX = mouseX;
        endY = mouseY;
        drawingStarted = false;

        const rectStartX = Math.max(xStart, Math.min(startX, endX));
        const rectStartY = Math.max(yStart, Math.min(startY, endY));
        const rectEndX = Math.min(xStart + renderableWidth, Math.max(startX, endX));
        const rectEndY = Math.min(yStart + renderableHeight, Math.max(startY, endY));
        console.log("[DEBUG] bounding box in screen coords:", 
          { rectStartX, rectStartY, rectEndX, rectEndY });

        const boxStartX = (rectStartX - xStart) / renderableWidth;
        const boxStartY = (rectStartY - yStart) / renderableHeight;
        const boxEndX = (rectEndX - xStart) / renderableWidth;
        const boxEndY = (rectEndY - yStart) / renderableHeight;

        const boxCenterX = (boxStartX + boxEndX) / 2;
        const boxCenterY = (boxStartY + boxEndY) / 2;
        const boxWidth = boxEndX - boxStartX;
        const boxHeight = boxEndY - boxStartY;

        console.log("[DEBUG] bounding box in normalized coords:", 
          { boxCenterX, boxCenterY, boxWidth, boxHeight });

        // build a matrix
        let M = identityMatrix();
        M = multiply(M, translate(boxCenterX, boxCenterY));
        M = multiply(M, scale(boxWidth/2, boxHeight/2));

        currentShape = {
          type: 'ellipse',
          classId: 0,
          localRadiusX: 1,
          localRadiusY: 1,
          transformMatrix: M,
          handlePositions: []
        };
        isRotationMode = false;
        console.log("[DEBUG] Created ellipse shape:", currentShape);
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
    if (currentShape) {
      shapes.push({ ...currentShape });
      currentShape = null;
    }
    redrawCanvas();
    saveAnnotations().then(() => {
      openAnnotationFile(window.currentImageFilename + '.txt');
    }).catch(err => console.error(err));
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
