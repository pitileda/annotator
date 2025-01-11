import { SERVER_URL } from "./constants.js";
import { redrawCanvas, resizeCanvas } from "./drawing.js";
import { setMode, getMode } from "./main.js";
import { shapeToPolygon } from "./utils.js";

const annotations = document.getElementById('annotations');

export function displayTxtFileNames() {
  const txtFileList = document.getElementById('txt-file-list');
  fetch(`${SERVER_URL}/list_annotations`)
    .then(response => response.json())
    .then(data => {
      let txtFiles = data.files;
      // sort them
      txtFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      txtFileList.innerHTML = '<h3>Annotation Files</h3>';

      txtFiles.forEach((filename) => {
        // Show only .txt
        if (filename.endsWith('.txt')) {
          const txtItem = document.createElement('div');
          txtItem.classList.add('txt-filename');
          txtItem.textContent = filename;
          txtItem.addEventListener('click', () => openAnnotationFile(filename));
          txtFileList.appendChild(txtItem);
        }
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

  fetch(`${SERVER_URL}/annotations/${filename}`)
    .then(response => response.ok ? response.text() : Promise.reject('No annotation file'))
    .then(text => {
      const lines = text.split('\n').filter(line => line.trim() !== '');
      shapes = []; // clear out old shapes

      if (getMode() === 'detection') {
        // detection mode => each line: "class cx cy w h" (5 floats)
        lines.forEach(line => {
          const vals = line.trim().split(' ').map(Number);
          if (vals.length === 5) {
            const [classId, cx, cy, w, h] = vals;
            shapes.push({
              type: 'rectangle',
              classId,
              centerX: cx,
              centerY: cy,
              width: w,
              height: h
            });
          } else {
            console.warn('Line does not match detection format, ignoring:', line);
          }
        });
      } else if (getMode() === 'segmentation') {
        // segmentation mode => each line is "class x1 y1 x2 y2..."
        lines.forEach(line => {
          const vals = line.trim().split(' ').map(Number);
          const classId = vals[0];
          const coords = vals.slice(1);
          // parse pairs
          const polygon = [];
          for (let i = 0; i < coords.length; i += 2) {
            polygon.push([coords[i], coords[i + 1]]);
          }
          shapes.push({
            type: 'polygon',  // or 'segmentation'
            classId,
            points: polygon
          });
        });
      }

      updateAnnotations();
    })
    .catch(error => {
      console.error(error);
      shapes = [];
      annotations.textContent = '';
      redrawCanvas();
    });
}

export function saveAnnotations() {
  if (getMode() === 'detection') {
    return saveDetectionAnnotations();
  } else if (getMode() === 'segmentation') {
    return saveSegmentationAnnotations();
  }
}

function saveDetectionAnnotations() {
  if (!shapes || shapes.length === 0) {
    console.log("No shapes to save in detection mode, skipping.");
  }

  let lines = shapes
    .filter(s => s.type === 'rectangle')  // only rectangles in detection
    .map(s => {
      return [
        s.classId,
        s.centerX.toFixed(6),
        s.centerY.toFixed(6),
        s.width.toFixed(6),
        s.height.toFixed(6)
      ].join(' ');
    });

  const content = lines.join('\n');

  return fetch(`${SERVER_URL}/save_annotation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: currentImageFilename + '.txt', // detection .txt
      content
    }),
  })
  .then(response => {
    if (response.ok) {
      alert('Detection annotation saved successfully on the server!');
      displayTxtFileNames();
    } else {
      alert('Failed to save detection annotation.');
    }
  })
  .catch(error => console.error('Error:', error));
}

function saveSegmentationAnnotations() {
  let lines = shapes.map(s => {
    // Convert shape => array of [ [x, y], [x2, y2], ... ]
    const poly = shapeToPolygon(s);
    if (!poly || poly.length === 0) {
      // skip empty or unknown shape
      return null;
    }

    // Build line: classId x1 y1 x2 y2 ...
    let lineVals = [ s.classId ?? 0 ];
    poly.forEach(([x, y]) => {
      lineVals.push(x.toFixed(6), y.toFixed(6));
    });
    return lineVals.join(' ');
  })
  .filter(Boolean); // remove null entries if shape was unknown

  const content = lines.join('\n');

  return fetch(`${SERVER_URL}/save_annotation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: currentImageFilename + '.txt', // same .txt for segmentation
      content
    }),
  })
  .then(response => {
    if (response.ok) {
      console.log('Segmentation annotation saved successfully on the server!');
      displayTxtFileNames();
    } else {
      console.error('Failed to save segmentation annotation.');
    }
  })
  .catch(error => console.error('Error:', error));
}

export function updateAnnotations() {
  if (getMode() === 'detection') {
    let annotationText = shapes
      .filter(s => s.type === 'rectangle')
      .map(s => {
        return [
          s.classId,
          s.centerX.toFixed(6),
          s.centerY.toFixed(6),
          s.width.toFixed(6),
          s.height.toFixed(6)
        ].join(' ');
      })
      .join('\n');
    annotations.textContent = annotationText;
  } else if (getMode() === 'segmentation') {
    let lines = shapes
      .filter(s => s.type === 'polygon')
      .map(s => {
        let lineVals = [ s.classId ];
        s.points.forEach(([x, y]) => {
          lineVals.push(x.toFixed(6), y.toFixed(6));
          // console.log("s: ", s);
        });
        return lineVals.join(' ');
      });
    annotations.textContent = lines.join('\n');
  }
  redrawCanvas();
}

export function openImageForAnnotation(index, fileItem, skipAnnotationFetch = false) {
  currentImageIndex = index;

  // highlight item
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

      // set currentImageFilename for saving
      const imageNameWithoutExtension = imageFiles[index].name.split('.').slice(0, -1).join('.');
      currentImageFilename = imageNameWithoutExtension;
      window.currentImageFilename = currentImageFilename;

      redrawCanvas();

      // If user wants auto-fetch of .txt annotation
      if (!skipAnnotationFetch) {
        const annotationFilename = currentImageFilename + '.txt';
        fetch(`${SERVER_URL}/annotations/${annotationFilename}`)
          .then(res => res.ok ? res.text() : Promise.reject('No annotation file'))
          .then(text => {
            const lines = text.split('\n').filter(l => l.trim() !== '');
            // parse lines by current mode
            if (getMode() === 'detection') {
              lines.forEach(line => {
                const vals = line.trim().split(' ').map(Number);
                if (vals.length === 5) {
                  const [classId, cx, cy, w, h] = vals;
                  shapes.push({
                    type: 'rectangle',
                    classId,
                    centerX: cx,
                    centerY: cy,
                    width: w,
                    height: h
                  });
                }
              });
            } else if (getMode() === 'segmentation') {
              lines.forEach(line => {
                const vals = line.trim().split(/\s+/).map(Number);
                if (vals.length >= 7) {
                  const classId = vals[0];
                  const coords = vals.slice(1);
                  const polygon = [];
                  for (let i=0; i<coords.length; i+=2) {
                    polygon.push([coords[i], coords[i+1]]);
                  }
                  shapes.push({
                    type: 'polygon',
                    classId,
                    points: polygon
                  });
                }
              });
            }
            updateAnnotations();
          })
          .catch(error => {
            console.warn(error);
            shapes = [];
            annotations.textContent = '';
            redrawCanvas();
          });
      }
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(localFile);
}