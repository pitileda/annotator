window.resizeCanvas = function() {
  const container = document.getElementById('canvas');
  const rect = container.getBoundingClientRect();

  canvas.width = rect.width;
  canvas.height = rect.height;

  redrawCanvas();
}

window.redrawCanvas = function() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (image && image.naturalWidth && image.naturalHeight) {
    const canvasAspect = canvas.width / canvas.height;
    const imageAspect = image.naturalWidth / image.naturalHeight;

    if (imageAspect < canvasAspect) {
      renderableHeight = canvas.height;
      renderableWidth = image.naturalWidth * (renderableHeight / image.naturalHeight);
      xStart = (canvas.width - renderableWidth) / 2;
      yStart = 0;
    } else {
      renderableWidth = canvas.width;
      renderableHeight = image.naturalHeight * (renderableWidth / image.naturalWidth);
      xStart = 0;
      yStart = (canvas.height - renderableHeight) / 2;
    }

    ctx.drawImage(image, xStart, yStart, renderableWidth, renderableHeight);

    shapes.forEach(shape => {
      drawShape(shape);
    });

    if (currentShape) {
      drawShape(currentShape, true);
    }
  }
}

window.drawShape = function(shape, isEditing = false) {
  const { type, centerX, centerY, width, height, rotation = 0 } = shape;
  const boxCenterX = xStart + centerX * renderableWidth;
  const boxCenterY = yStart + centerY * renderableHeight;
  const boxWidth = width * renderableWidth;
  const boxHeight = height * renderableHeight;

  ctx.save();
  ctx.translate(boxCenterX, boxCenterY);
  ctx.rotate(rotation);
  ctx.translate(-boxCenterX, -boxCenterY);

  if (type === 'ellipse') {
    ctx.strokeStyle = 'blue';
    ctx.beginPath();
    ctx.ellipse(boxCenterX, boxCenterY, boxWidth / 2, boxHeight / 2, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
    ctx.fill();
    if (isEditing) drawBoundingBoxAndHandles(boxCenterX, boxCenterY, boxWidth, boxHeight, rotation);
  } else if (type === 'rectangle') {
    ctx.strokeStyle = 'orange';
    ctx.strokeRect(boxCenterX - boxWidth / 2, boxCenterY - boxHeight / 2, boxWidth, boxHeight);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.fillRect(boxCenterX - boxWidth / 2, boxCenterY - boxHeight / 2, boxWidth, boxHeight);
  }

  ctx.restore();
}

window.drawBoundingBoxAndHandles = function(centerX, centerY, width, height, rotation) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.translate(-centerX, -centerY);

  ctx.strokeStyle = 'red';
  ctx.lineWidth = 1;
  ctx.strokeRect(centerX - width / 2, centerY - height / 2, width, height);

  const positions = [
    { x: centerX - width / 2, y: centerY - height / 2 },
    { x: centerX + width / 2, y: centerY - height / 2 },
    { x: centerX + width / 2, y: centerY + height / 2 },
    { x: centerX - width / 2, y: centerY + height / 2 }
  ];

  positions.forEach(pos => {
    if (isRotationMode) {
      ctx.strokeStyle = 'purple';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, HANDLE_SIZE, 0, Math.PI / 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, HANDLE_SIZE / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  });

  ctx.restore();
}
