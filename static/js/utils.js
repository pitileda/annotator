import { HANDLE_SIZE } from "./constants.js";
import { redrawCanvas } from "./drawing.js";

const canvas = document.getElementById('canvas');

export function ellipseToPolygon(centerX, centerY, radiusX, radiusY, rotation, numPoints) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const x = centerX + radiusX * Math.cos(theta);
    const y = centerY + radiusY * Math.sin(theta);
    points.push(x, y);
  }
  return points;
}

export function calculatePolygonArea(polygon) {
  let area = 0;
  const numPoints = polygon.length / 2;
  for (let i = 0; i < numPoints; i++) {
    const x1 = polygon[(i * 2) % polygon.length];
    const y1 = polygon[(i * 2 + 1) % polygon.length];
    const x2 = polygon[((i * 2 + 2) % polygon.length) || 0];
    const y2 = polygon[((i * 2 + 3) % polygon.length) || 1];
    area += (x1 * y2 - x2 * y1);
  }
  return Math.abs(area / 2);
}

export function calculateBoundingBox(polygon) {
  const xCoords = [];
  const yCoords = [];
  for (let i = 0; i < polygon.length; i += 2) {
    xCoords.push(polygon[i]);
    yCoords.push(polygon[i + 1]);
  }
  const xMin = Math.min(...xCoords);
  const yMin = Math.min(...yCoords);
  const xMax = Math.max(...xCoords);
  const yMax = Math.max(...yCoords);
  return [xMin, yMin, xMax - xMin, yMax - yMin];
}

export function getMousePosition(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const x = (mouseX - xStart) / renderableWidth;
  const y = (mouseY - yStart) / renderableHeight;
  return { x, y, mouseX, mouseY };
}

export function getHandleAtPoint(x, y) {
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

export function handleDragging(x, y) {
  if (draggedHandleIndex === -1 || !currentShape) return;

  const { centerX, centerY, width, height } = currentShape;

  // Determine opposite corner (the corner diagonally across from the handle).
  let oppositeX, oppositeY;
  if (draggedHandleIndex === 0) { 
    // top-left handle opposite corner is bottom-right
    oppositeX = centerX + width / 2;
    oppositeY = centerY + height / 2;
  } else if (draggedHandleIndex === 1) {
    // top-right handle opposite corner is bottom-left
    oppositeX = centerX - width / 2;
    oppositeY = centerY + height / 2;
  } else if (draggedHandleIndex === 2) {
    // bottom-right handle opposite corner is top-left
    oppositeX = centerX - width / 2;
    oppositeY = centerY - height / 2;
  } else if (draggedHandleIndex === 3) {
    // bottom-left handle opposite corner is top-right
    oppositeX = centerX + width / 2;
    oppositeY = centerY - height / 2;
  }

  // Calculate new dimensions from min and max values
  const newMinX = Math.min(x, oppositeX);
  const newMaxX = Math.max(x, oppositeX);
  const newWidth = newMaxX - newMinX;
  const newCenterX = (newMinX + newMaxX) / 2;

  const newMinY = Math.min(y, oppositeY);
  const newMaxY = Math.max(y, oppositeY);
  const newHeight = newMaxY - newMinY;
  const newCenterY = (newMinY + newMaxY) / 2;

  // Update the currentShape with these new values
  currentShape.width = newWidth;
  currentShape.height = newHeight;
  currentShape.centerX = newCenterX;
  currentShape.centerY = newCenterY;

  redrawCanvas();
}

export function isPointInEllipse(x, y, shape) {
  const dx = x - shape.centerX;
  const dy = y - shape.centerY;
  const cos = Math.cos(-shape.rotation || 0);
  const sin = Math.sin(-shape.rotation || 0);

  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  return (rx * rx) / ((shape.width / 2) ** 2) +
         (ry * ry) / ((shape.height / 2) ** 2) <= 1;
}