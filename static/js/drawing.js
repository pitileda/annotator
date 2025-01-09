import { HANDLE_SIZE } from "./constants.js";

let canvas = document.getElementById('canvas'); 
const ctx = canvas.getContext('2d');

export function resizeCanvas() {
  const container = document.getElementById('canvas');
  const rect = container.getBoundingClientRect();

  canvas.width = rect.width;
  canvas.height = rect.height;

  redrawCanvas();
}

export function redrawCanvas() {
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

function drawShape(shape, isEditing = false) {
  const { type } = shape;

  // 1) If it's a polygon:
  if (type === 'polygon') {
    // shape.points = [ [nx, ny], [nx2, ny2], ... ] in normalized coords
    ctx.beginPath();
    shape.points.forEach(([nx, ny], index) => {
      // Convert normalized -> canvas coords
      const px = xStart + nx * renderableWidth;
      const py = yStart + ny * renderableHeight;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();

    // Fill and stroke
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fill();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Optionally, if you want to show "handles" on each vertex in editing mode:
    if (isEditing) {
      shape.points.forEach(([nx, ny]) => {
        const px = xStart + nx * renderableWidth;
        const py = yStart + ny * renderableHeight;
        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.arc(px, py, HANDLE_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.stroke();
      });
    }
    return; // done
  }

  // 2) If it's an ellipse:
  if (type === 'ellipse') {
    // old code that draws ellipse from centerX, centerY, width, height, rotation
    const { centerX, centerY, width, height, rotation = 0 } = shape;
    const boxCenterX = xStart + centerX * renderableWidth;
    const boxCenterY = yStart + centerY * renderableHeight;
    const boxWidth = width * renderableWidth;
    const boxHeight = height * renderableHeight;

    // Save/transform for rotation
    ctx.save();
    ctx.translate(boxCenterX, boxCenterY);
    ctx.rotate(rotation);
    ctx.translate(-boxCenterX, -boxCenterY);

    // Draw the ellipse
    ctx.strokeStyle = 'blue';
    ctx.beginPath();
    ctx.ellipse(boxCenterX, boxCenterY, boxWidth / 2, boxHeight / 2, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
    ctx.fill();

    // If editing, draw bounding box & corners
    if (isEditing) {
      drawBoundingBoxAndHandles(boxCenterX, boxCenterY, boxWidth, boxHeight, rotation);
    }
    ctx.restore();
    return;
  }

  // 3) If it's a rectangle (for detection):
  if (type === 'rectangle') {
    const { classId, centerX, centerY, width, height } = shape;
    const boxCenterX = xStart + centerX * renderableWidth;
    const boxCenterY = yStart + centerY * renderableHeight;
    const boxWidth = width * renderableWidth;
    const boxHeight = height * renderableHeight;

    ctx.save();
    // Draw the rectangle
    ctx.strokeStyle = 'orange';
    ctx.strokeRect(
      boxCenterX - boxWidth / 2,
      boxCenterY - boxHeight / 2,
      boxWidth,
      boxHeight
    );
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.fillRect(
      boxCenterX - boxWidth / 2,
      boxCenterY - boxHeight / 2,
      boxWidth,
      boxHeight
    );
    ctx.restore();
  }
}

const drawBoundingBoxAndHandles = function(centerX, centerY, width, height, rotation) {
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
