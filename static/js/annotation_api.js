import { SERVER_URL } from "./constants.js";
import { redrawCanvas, resizeCanvas } from "./drawing.js";
import { setMode, getMode } from "./main.js";
import { ellipseToPolygon, calculatePolygonArea } from "./utils.js";
import { calculateBoundingBox } from "./utils.js";

const annotations = document.getElementById('annotations');

export async function fetchAnnotations() {
  try {
      const response = await fetch(`${SERVER_URL}/list_annotations`);
      if (response.ok) {
          return response.json();
      }
  } catch (error) {
      console.error('Error fetching annotations:', error);
  }
}

export function displayTxtFileNames() {
  const txtFileList = document.getElementById('txt-file-list');
  fetch(`${SERVER_URL}/list_annotations`)
    .then(response => response.json())
    .then(data => {
      let txtFiles = data.files;
      txtFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      txtFileList.innerHTML = '<h3>Annotation Files</h3>';
      txtFiles.forEach((filename) => {
        const txtItem = document.createElement('div');
        txtItem.classList.add('txt-filename');
        txtItem.textContent = filename;
        txtItem.addEventListener('click', () => openAnnotationFile(filename));
        txtFileList.appendChild(txtItem);
      });
    })
    .catch(error => console.error('Error fetching annotation files:', error));
}

function findLocalImageFile(annotationFilename) {
  const baseName = annotationFilename.replace(/\.[^/.]+$/, "");

  const foundIndex = imageFiles.findIndex((file) => {
    const justName = file.name.replace(/\.[^/.]+$/, "");
    return justName === baseName; 
  });

  if (foundIndex === -1) {
    return null;
  }

  return {
    file: imageFiles[foundIndex],
    index: foundIndex,
    baseName
  };
}

export function openAnnotationFile(filename) {
  if (filename.endsWith('.txt')) {
    setMode('detection')
  } else if (filename.endsWith('.json')) {
    setMode('segmentation')
  }

  const found = findLocalImageFile(filename);
  if (!found) {
    alert('No local image file matches the annotation file: ' + filename);
    return;
  }

  openImageForAnnotation(
    found.index,
    null,
    true
  );

  if (getMode() === 'detection') {
    fetch(`${SERVER_URL}/annotations/${filename}`)
      .then(response => response.text())
      .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        shapes = lines.map(line => {
          const [classId, centerX, centerY, width, height] = line.split(' ').map(Number);
          return { classId, type: 'rectangle', centerX, centerY, width, height };
        });
        updateAnnotations();
      })
      .catch(error => console.error('Error fetching annotation file:', error));
  } else if (getMode() === 'segmentation') {
    fetch(`${SERVER_URL}/annotations/${filename}`)
      .then(response => response.json())
      .then(data => {
        const imageId = currentImageIndex + 1; 
        const imageAnnotations = data.annotations.filter(ann => ann.image_id === imageId);

        shapes = imageAnnotations.map(ann => {
          const [xMin, yMin, w, h] = ann.bbox;
          const centerX = xMin + w/2;
          const centerY = yMin + h/2;
          const normCenterX = centerX / image.width;
          const normCenterY = centerY / image.height;
          const normWidth   = w / image.width;
          const normHeight  = h / image.height;

          return {
            classId: ann.category_id,
            type: 'ellipse',
            centerX: normCenterX,
            centerY: normCenterY,
            width: normWidth,
            height: normHeight,
            polygon: ann.segmentation[0]
          };
        });
        updateAnnotations();
      })
      .catch(error => console.error('Error fetching annotation file:', error));
  }
}

export function saveAnnotations() {
  if (getMode() === 'detection') {
    saveDetectionAnnotations();
  } else if (getMode() === 'segmentation') {
    saveSegmentationAnnotations();
  }
}

function saveDetectionAnnotations() {
  let annotationText = '';
  if (shapes.length > 0) {
    annotationText = shapes.map(({ classId, centerX, centerY, width, height }) =>
      `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`
    ).join('\n');
  }

  fetch(`${SERVER_URL}/save_annotation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: currentImageFilename + '.txt',
      content: annotationText
    }),
  }).then(response => {
    if (response.ok) {
      alert('Annotation saved successfully on the server!');
      displayTxtFileNames();
    } else {
      alert('Failed to save annotation.');
    }
  }).catch(error => console.error('Error:', error));
}

function saveSegmentationAnnotations() {
  const imageNameWithoutExtension = imageFiles[currentImageIndex].name.split('.').slice(0, -1).join('.');
  const jsonFilename = imageNameWithoutExtension + '.json';

  const imageId = currentImageIndex + 1;
  const annotationsList = [];
  let annotationId = 1;

  shapes.forEach(shape => {
    if (shape.type === 'ellipse') {
      const { centerX, centerY, width, height, classId } = shape;
      const absCenterX = centerX * image.width;
      const absCenterY = centerY * image.height;
      const absRadiusX = (width * image.width) / 2;
      const absRadiusY = (height * image.height) / 2;

      const polygon = ellipseToPolygon(absCenterX, absCenterY, absRadiusX, absRadiusY, 0, 50);
      const area = calculatePolygonArea(polygon);
      const [xMin, yMin, boxWidth, boxHeight] = calculateBoundingBox(polygon);

      const annotation = {
        "id": annotationId++,
        "image_id": imageId,
        "category_id": classId,
        "segmentation": [polygon],
        "area": area,
        "bbox": [xMin, yMin, boxWidth, boxHeight],
        "iscrowd": 0
      };
      annotationsList.push(annotation);
    }
  });

  const cocoJson = {
    "images": [
      {
        "id": imageId,
        "file_name": imageFiles[currentImageIndex].name,
        "width": image.width,
        "height": image.height
      }
    ],
    "annotations": annotationsList,
    "categories": [
      { "id": 0, "name": "object", "supercategory": "none" }
    ]
  };

  fetch(`${SERVER_URL}/save_annotation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: jsonFilename,
      content: JSON.stringify(cocoJson)
    }),
  }).then(response => {
    if (response.ok) {
      alert('Segmentation annotation saved successfully on the server!');
      displayTxtFileNames();
    } else {
      alert('Failed to save segmentation annotation.');
    }
  }).catch(error => console.error('Error:', error));
}

export function updateAnnotations() {
  if (getMode() === 'detection') {
    let annotationText = shapes
      .filter(shape => shape.type === 'rectangle')
      .map(({ classId, centerX, centerY, width, height }) =>
        `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`
      ).join('\n');
    annotations.textContent = annotationText;
  } else if (getMode() === 'segmentation') {
    let annotationText = shapes
      .filter(shape => shape.type === 'ellipse')
      .map(({ classId, centerX, centerY, width, height }) => ({
        classId,
        centerX: centerX.toFixed(6),
        centerY: centerY.toFixed(6),
        width: width.toFixed(6),
        height: height.toFixed(6)
      }));
    annotations.textContent = JSON.stringify(annotationText, null, 2);
  }
  redrawCanvas();
}

export function openImageForAnnotation(index, fileItem, skipAnnotationFetch = false) {
  currentImageIndex = index;

  // If a fileItem (the <div> in the left sidebar) was passed, 
  // highlight it. If not, do nothing (maybe we are clicking annotation in the right panel).
  if (fileItem) {
    if (selectedImageElement) {
      selectedImageElement.classList.remove('selected');
    }
    fileItem.classList.add('selected');
    selectedImageElement = fileItem;
  }

  const localFile = imageFiles[index];
  const reader = new FileReader();
  reader.onload = () => {
    image.onload = () => {
      resizeCanvas();
      shapes = [];
      annotations.textContent = '';
      const imageNameWithoutExtension = imageFiles[index].name.split('.').slice(0, -1).join('.');
      currentImageFilename = imageNameWithoutExtension;
      redrawCanvas();

      if (!skipAnnotationFetch) {
        if (getMode() === 'detection') {
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
      } // end if skip
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(imageFiles[index]);
}