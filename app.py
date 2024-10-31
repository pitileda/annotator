import os
import json
import argparse
import logging
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

logging.basicConfig(level=logging.DEBUG)

parser = argparse.ArgumentParser(description="YOLOv5 Annotation Tool Server")
parser.add_argument(
    "--labels-folder", type=str, required=True, help="Path to the labels folder"
)
args = parser.parse_args()

LABELS_FOLDER = args.labels_folder
os.makedirs(LABELS_FOLDER, exist_ok=True)

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)  # Enable CORS


@app.route("/")
def index():
    return render_template("home.html")


@app.route("/save_annotation", methods=["POST"])
def save_annotation():
    data = request.get_json(force=True)
    filename = data.get("filename")
    content = data.get("content")

    logging.debug(f"Received filename: {filename}")

    if not filename or content is None:
        return jsonify({"message": "Invalid data: Missing filename or content"}), 400

    # Validate filename to prevent directory traversal attacks
    allowed_extensions = {".txt", ".json"}
    _, ext = os.path.splitext(filename)
    if ext not in allowed_extensions:
        return jsonify({"message": "Invalid file extension"}), 400

    # Construct the safe file path
    safe_filename = secure_filename(filename)
    filepath = os.path.join(LABELS_FOLDER, safe_filename)

    try:
        # If saving a JSON file, ensure content is properly formatted
        if ext == ".json":
            # Validate that the content is valid JSON
            json_content = json.loads(content)
            # Write the JSON content to the file with proper formatting
            with open(filepath, "w") as f:
                json.dump(json_content, f, indent=2)
        else:
            # For text files, write the content directly
            with open(filepath, "w") as f:
                f.write(content)
        return jsonify({"message": "File saved successfully"}), 200
    except Exception as e:
        logging.error(f"Error saving annotation: {e}")
        return jsonify({"message": "Failed to save annotation"}), 500


# Route to serve existing annotation files
@app.route("/annotations/<path:filename>", methods=["GET"])
def get_annotation_file(filename):
    annotation_path = os.path.join(LABELS_FOLDER, filename)
    if os.path.exists(annotation_path):
        return send_from_directory(LABELS_FOLDER, filename)
    else:
        return "Annotation file not found", 404


# Route to list annotation files
@app.route("/list_annotations", methods=["GET"])
def list_annotations():
    files = os.listdir(LABELS_FOLDER)
    annotation_files = [f for f in files if f.endswith(".txt") or f.endswith(".json")]
    annotation_files.sort()  # Sort the list alphanumerically
    return jsonify({"files": annotation_files})


if __name__ == "__main__":
    app.run(port=5000)
