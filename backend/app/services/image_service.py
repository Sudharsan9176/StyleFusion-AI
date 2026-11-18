import os
import uuid
from PIL import Image
from flask import current_app
from werkzeug.datastructures import FileStorage

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
MAX_FILE_BYTES = 10 * 1024 * 1024


class ImageValidationError(Exception):
    pass


def save_uploaded_image(file: FileStorage, subfolder: str, min_dim: int = 256) -> tuple[str, str]:
    if not file or not file.filename:
        raise ImageValidationError('No image file provided.')

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ImageValidationError('Unsupported image format. Allowed: JPG, JPEG, PNG, WEBP.')

    file.stream.seek(0, os.SEEK_END)
    size = file.stream.tell()
    file.stream.seek(0)
    if size > MAX_FILE_BYTES:
        raise ImageValidationError('Image file exceeds 10 MB size limit.')

    try:
        img = Image.open(file.stream)
        width, height = img.size
        img.verify()
    except Exception as exc:
        raise ImageValidationError('Uploaded file is not a valid image.') from exc

    if width < min_dim or height < min_dim:
        raise ImageValidationError(f'Image resolution ({width}x{height}) must be at least {min_dim}x{min_dim}px.')

    file.stream.seek(0)
    target_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], subfolder)
    os.makedirs(target_dir, exist_ok=True)

    filename = f'{subfolder}_{uuid.uuid4().hex}{ext}'
    disk_path = os.path.join(target_dir, filename)
    file.save(disk_path)

    public_url = f'/uploads/{subfolder}/{filename}'
    return disk_path, public_url


def resolve_image_disk_path(image_path_or_url: str) -> str | None:
    if image_path_or_url.startswith('http://') or image_path_or_url.startswith('https://'):
        return None
    clean = image_path_or_url.lstrip('/')
    base_dir = os.path.abspath(os.path.join(current_app.root_path, '..'))
    candidate_backend = os.path.join(base_dir, clean)
    if os.path.exists(candidate_backend):
        return candidate_backend
    candidate_project = os.path.abspath(os.path.join(base_dir, '..', clean))
    if os.path.exists(candidate_project):
        return candidate_project
    return None
