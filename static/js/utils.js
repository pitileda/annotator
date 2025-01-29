import { HANDLE_SIZE } from "./constants.js";
import * as Matrix from './matrix.js';

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

export function getEllipseHandleAtPoint(xNorm, yNorm, shape) {
  console.log("getEllipseHandleAtPoint: Checking handles for shape:", shape);
  const localHandles = shape.handlePositions;

  let minDist = Infinity;
  let clickedIndex = -1;

  const mouseWX = xStart + xNorm * renderableWidth;
  const mouseWY = yStart + yNorm * renderableHeight;
  console.log(`--> Mouse worldX=${mouseWX.toFixed(2)}, worldY=${mouseWY.toFixed(2)}`);

  for (let i = 0; i < localHandles.length; i++) {
    // Now we have world coords. Mouse in world coords is:
    const mouseWX = xStart + xNorm * renderableWidth;
    const mouseWY = yStart + yNorm * renderableHeight;

    const dx = localHandles[i].x - mouseWX;
    const dy = localHandles[i].y - mouseWY;
    const dist = Math.sqrt(dx*dx + dy*dy);


    if (dist <= HANDLE_SIZE) {
      if (dist < minDist) {
        minDist = dist;
        clickedIndex = i;
      }
    }
  }

  console.log("getEllipseHandleAtPoint => handleIndex=", clickedIndex);
  return clickedIndex;
}

function buildShearX(k) {
  return [1, 0, k, 1, 0, 0]; 
}
function buildShearY(k) {
  return [1, k, 0, 1, 0, 0];
}

/**
 * handleDraggingEllipse(xNorm, yNorm, handleIndex, shape)
 *   - xNorm, yNorm: new mouse position in normalized image coords (0..1).
 *   - handleIndex: which ellipse handle is dragged (0..7).
 *   - shape: { type: 'ellipse', etc. }
 */
export function handleDraggingEllipse(xNorm, yNorm, handleIndex, shape) {
  const invM = Matrix.invert(shape.transformMatrix);  // from matrix.js
  const [mx, my] = Matrix.transformPoint(invM, xNorm, yNorm);

  let transform = null; // the incremental transform for each mouse-move

  if (handleIndex >= 0 && handleIndex <= 3) {
    const newDistX = Math.abs(mx);
    const newDistY = Math.abs(my);

    // Build a scale matrix
    transform = [
      newDistX, 0,
      0, newDistY,
      0, 0
    ];

  } else {
    if (handleIndex === 4 || handleIndex === 6) {
      const k = mx;  // or (mx - hx), etc.
      transform = buildShearX(k);

    } else if (handleIndex === 5 || handleIndex === 7) {
      // right-center or left-center => shear in Y
      const k = my; 
      transform = buildShearY(k);
    }
  }

  if (!transform) return; // no transform => no change
  shape.transformMatrix = Matrix.multiply(shape.transformMatrix, transform);
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
      // 1) create local circle => e.g. 36 points
      const numPoints = 36;
      const localPoints = [];
      for (let i=0; i<numPoints; i++) {
        const theta = 2*Math.PI*(i/numPoints);
        const lx = shape.localRadiusX * Math.cos(theta);
        const ly = shape.localRadiusY * Math.sin(theta);
        localPoints.push([lx, ly]);
      }
      // 2) transform each local point => world coords
      const [a,b,c,d,e,f] = shape.transformMatrix;
      const polygon = localPoints.map(([lx, ly]) => {
        const X = a*lx + c*ly + e;
        const Y = b*lx + d*ly + f;
        return [X, Y];
      });
      return polygon;
    }

    default:
      console.warn("Unknown shape type, ignoring:", shape);
      return [];
  }
}