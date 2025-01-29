import { HANDLE_SIZE } from "./constants.js";
import * as Matrix from './matrix.js';

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
  // console.log("[DEBUG] redrawCanvas() called. shapes.length=", 
  //   shapes.length, " currentShape=", currentShape);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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
      console.log(`[DEBUG] Drawing shape #${idx} type=${shape.type}`, shape);
      drawShape(shape);
    });

    if (currentShape) {
      // console.log("[DEBUG] Drawing currentShape type=", 
      //   currentShape.type, currentShape);
      drawShape(currentShape, true);
    }
  }
}

function drawShape(shape, isEditing = false) {
  // console.log("[DEBUG] drawShape. type=", shape.type, " isEditing=", isEditing);
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
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
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
    // console.log("[DEBUG] ellipse => using transformMatrix:", shape.transformMatrix);
    ctx.save();
    const [a,b,c,d,e,f] = shape.transformMatrix;
    ctx.transform(renderableWidth, 0, 0, renderableHeight, xStart, yStart);
    ctx.transform(a,b,c,d,e,f);
    ctx.beginPath();
    ctx.ellipse(0, 0, shape.localRadiusX, shape.localRadiusY, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = 'green';
    ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
    ctx.fill();

    // TODO add coinst stroke
    // ctx.lineWidth = 2 * a;
    // ctx.stroke();

    // If editing, draw bounding box & corners
    if (isEditing) {
      drawBoundingBoxAndHandlesEllipse8(shape);
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
  }
}


function drawBoundingBoxAndHandlesEllipse8(shape) {
  // transform is still active from the caller
  const rx = shape.localRadiusX;
  const ry = shape.localRadiusY;

  const t = ctx.getTransform();

  ctx.restore();

  const finalMatrix = Matrix.multiply(
    [renderableWidth, 0, 0, renderableHeight, xStart, yStart],
    shape.transformMatrix
  );

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  const steps = 36;
  for (let i = 0; i < steps; i++) {
    const theta = (2 * Math.PI * i) / steps;
    const lx = shape.localRadiusX * Math.cos(theta);
    const ly = shape.localRadiusY * Math.sin(theta);
    const [curr_x, curr_y] = Matrix.transformPoint(finalMatrix, lx, ly);

    if (curr_x < minX) minX = curr_x;
    if (curr_x > maxX) maxX = curr_x;
    if (curr_y < minY) minY = curr_y;
    if (curr_y > maxY) maxY = curr_y;
  }

  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;

  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.strokeRect( minX, minY, boxWidth, boxHeight);
  // handles
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  shape.handlePositions = [
    // corners
    { x: minX, y: minY },       // top-left
    { x: maxX, y: minY },       // top-right
    { x: maxX, y: maxY },       // bottom-right
    { x: minX, y: maxY },       // bottom-left

    // mid‐sides
    { x: cx,   y: minY },       // top-center
    { x: maxX, y: cy },         // right-center
    { x: cx,   y: maxY },       // bottom-center
    { x: minX, y: cy },         // left-center
  ];

  ctx.beginPath();
  shape.handlePositions.forEach( pos => {
    ctx.moveTo(pos.x + 4, pos.y);
    ctx.arc(pos.x, pos.y, 4, 0, 2*Math.PI);
  });
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';

  ctx.fill();
}
