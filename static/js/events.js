window.getMousePosition = function(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const x = (mouseX - xStart) / renderableWidth;
  const y = (mouseY - yStart) / renderableHeight;
  return { x, y, mouseX, mouseY };
}

window.getHandleAtPoint = function(x, y) {
  if (!currentShape) return -1;

  const { centerX, centerY, width, height } = currentShape;
  const boxCenterX = xStart + centerX * renderableWidth;
  const boxCenterY = yStart + centerY * renderableHeight;
  const boxWidth = width * renderableWidth;
  const boxHeight = height * renderableHeight;

  const positions = [
    { x: boxCenterX - boxWidth / 2, y: boxCenterY - boxHeight / 2 },
    { x: boxCenterX + boxWidth / 2, y: boxCenterY - boxHeight / 2 },
    { x: boxCenterX + boxWidth / 2, y: boxCenterY + boxHeight / 2 },
    { x: boxCenterX - boxWidth / 2, y: boxCenterY + boxHeight / 2 }
  ];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const dx = (pos.x - (xStart + x * renderableWidth));
    const dy = (pos.y - (yStart + y * renderableHeight));
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= HANDLE_SIZE / 2) {
      return i; // Return the index of the handle
    }
  }
  return -1;
}

window.handleDragging = function(x, y) {
  if (draggedHandleIndex === -1 || !currentShape) return;

  const { centerX, centerY, width, height } = currentShape;
  let newWidth = width;
  let newHeight = height;
  let newCenterX = centerX;
  let newCenterY = centerY;

  // Adjust width/height based on handle
  if (draggedHandleIndex === 0) { // Top-left
    const rightX = centerX + width / 2;
    const bottomY = centerY + height / 2;
    newWidth = rightX - x;
    newHeight = bottomY - y;
    newCenterX = x + newWidth / 2;
    newCenterY = y + newHeight / 2;
  } else if (draggedHandleIndex === 1) { // Top-right
    const leftX = centerX - width / 2;
    const bottomY = centerY + height / 2;
    newWidth = x - leftX;
    newHeight = bottomY - y;
    newCenterX = leftX + newWidth / 2;
    newCenterY = y + newHeight / 2;
  } else if (draggedHandleIndex === 2) { // Bottom-right
    const leftX = centerX - width / 2;
    const topY = centerY - height / 2;
    newWidth = x - leftX;
    newHeight = y - topY;
    newCenterX = leftX + newWidth / 2;
    newCenterY = topY + newHeight / 2;
  } else if (draggedHandleIndex === 3) { // Bottom-left
    const rightX = centerX + width / 2;
    const topY = centerY - height / 2;
    newWidth = rightX - x;
    newHeight = y - topY;
    newCenterX = x + newWidth / 2;
    newCenterY = topY + newHeight / 2;
  }

  currentShape.width = newWidth;
  currentShape.height = newHeight;
  currentShape.centerX = newCenterX;
  currentShape.centerY = newCenterY;
}

window.isPointInEllipse = function(x, y, shape) {
  const dx = x - shape.centerX;
  const dy = y - shape.centerY;
  const cos = Math.cos(-shape.rotation || 0);
  const sin = Math.sin(-shape.rotation || 0);

  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  return (rx * rx) / ((shape.width / 2) ** 2) +
         (ry * ry) / ((shape.height / 2) ** 2) <= 1;
}

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
        currentMode = 'detection';
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
        currentMode = 'segmentation';
        updateAnnotations();
      })
      .catch(error => console.error('Error fetching annotation file:', error));
  }
}

window.openImageForAnnotation = function(index, fileItem) {
  currentImageIndex = index;

  if (selectedImageElement) {
    selectedImageElement.classList.remove('selected');
  }

  fileItem.classList.add('selected');
  selectedImageElement = fileItem;

  const reader = new FileReader();
  reader.onload = () => {
    image.onload = () => {
      resizeCanvas();
      shapes = [];
      annotations.textContent = '';
      const imageNameWithoutExtension = imageFiles[index].name.split('.').slice(0, -1).join('.');
      currentImageFilename = imageNameWithoutExtension;
      redrawCanvas();

      if (currentMode === 'detection') {
        const detectionFilename = currentImageFilename + '.txt';
        fetch(`${SERVER_URL}/annotations/${detectionFilename}`)
          .then(response => response.ok ? response.text() : Promise.reject('No detection file'))
          .then(text => {
            const lines = text.split('\n').filter(line => line.trim() !== '');
            shapes = lines.map(line => {
              const [classId, centerX, centerY, width, height] = line.split(' ').map(Number);
              return { classId, type:'rectangle', centerX, centerY, width, height };
            });
            updateAnnotations();
          })
          .catch(error => {
            console.log(error);
            shapes = [];
            annotations.textContent = '';
            redrawCanvas();
          });
      } else {
        const segmentationFilename = currentImageFilename + '.json';
        fetch(`${SERVER_URL}/annotations/${segmentationFilename}`)
          .then(response => response.ok ? response.json() : Promise.reject('No segmentation file'))
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
            updateAnnotations();
          })
          .catch(error => {
            console.log(error);
            shapes = [];
            annotations.textContent = '';
            redrawCanvas();
          });
      }
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(imageFiles[index]);
}

window.openNextImage = function() {
  if (currentImageIndex < imageFiles.length - 1) {
    const nextIndex = currentImageIndex + 1;
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
