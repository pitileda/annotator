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

/**
 * Convert a shape (rectangle, ellipse, or polygon) into an array of
 * normalized polygon [ [x1,y1], [x2,y2], ... ] coordinates.
 */
export function shapeToPolygon(shape) {
  switch (shape.type) {
    case 'polygon':
      // Already a polygon => just return the existing points
      return shape.points;

    case 'rectangle': {
      // Convert rectangle to a 4-corner polygon
      const { centerX, centerY, width, height } = shape;
      const left = centerX - width / 2;
      const right = centerX + width / 2;
      const top = centerY - height / 2;
      const bottom = centerY + height / 2;

      // Return corners in clockwise or counter-clockwise order
      return [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom]
      ];
    }

    case 'ellipse': {
      // Approximate an ellipse with N points
      const { centerX, centerY, width, height, rotation = 0 } = shape;
      const rx = width / 2;   // "radius" in x direction
      const ry = height / 2;  // "radius" in y direction
      const numPoints = 36;   // how many segments to approximate

      const points = [];
      for (let i = 0; i < numPoints; i++) {
        const theta = (2 * Math.PI * i) / numPoints;

        // local coordinates (unrotated)
        let lx = rx * Math.cos(theta);
        let ly = ry * Math.sin(theta);

        // apply rotation around (0,0) if shape has 'rotation'
        if (rotation !== 0) {
          const cosR = Math.cos(rotation);
          const sinR = Math.sin(rotation);
          // rotate (lx, ly)
          const rx2 = lx * cosR - ly * sinR;
          const ry2 = lx * sinR + ly * cosR;
          lx = rx2;
          ly = ry2;
        }

        // translate by center
        const finalX = centerX + lx;
        const finalY = centerY + ly;

        points.push([finalX, finalY]);
      }
      return points;
    }

    default:
      console.warn("Unknown shape type, ignoring:", shape);
      return [];
  }
}