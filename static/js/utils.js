window.ellipseToPolygon = function(centerX, centerY, radiusX, radiusY, rotation, numPoints) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const x = centerX + radiusX * Math.cos(theta);
    const y = centerY + radiusY * Math.sin(theta);
    points.push(x, y);
  }
  return points;
}

window.calculatePolygonArea = function(polygon) {
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

window.calculateBoundingBox = function(polygon) {
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
