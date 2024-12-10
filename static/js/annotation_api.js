window.displayTxtFileNames = function() {
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

window.saveAnnotations = function() {
  if (currentMode === 'detection') {
    saveDetectionAnnotations();
  } else if (currentMode === 'segmentation') {
    saveSegmentationAnnotations();
  }
}

window.saveDetectionAnnotations = function() {
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

window.saveSegmentationAnnotations = function() {
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

window.updateAnnotations = function() {
  if (currentMode === 'detection') {
    let annotationText = shapes
      .filter(shape => shape.type === 'rectangle')
      .map(({ classId, centerX, centerY, width, height }) =>
        `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`
      ).join('\n');
    annotations.textContent = annotationText;
  } else if (currentMode === 'segmentation') {
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
