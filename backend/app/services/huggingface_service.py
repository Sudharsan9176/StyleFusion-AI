import base64
import os
import re
import shutil
import time
import uuid
import requests
from flask import current_app


class HuggingFaceServiceError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class HuggingFaceService:
    """
    Configurable Hugging Face Virtual Try-On adapter.
    Supports:
      1. Custom HTTP Inference Endpoint / HF Dedicated Inference Endpoint (HF_API_URL)
      2. Gradio Space API via gradio_client (yisol/IDM-VTON, zhengchong/CatVTON, levihsu/OOTDiffusion)
    """

    def __init__(self, token: str | None = None, model_id: str | None = None, api_url: str | None = None):
        self.token = token or current_app.config.get('HF_API_TOKEN')
        self.model_id = model_id or current_app.config.get('HF_MODEL_ID') or 'yisol/IDM-VTON'
        self.api_url = api_url or current_app.config.get('HF_API_URL')

    def generate_tryon(
        self,
        person_image_path: str,
        garment_image_path_or_url: str,
        category: str = 'upper_body',
        garment_description: str = 'Fashion garment',
        denoise_steps: int = 30,
        seed: int = 42,
    ) -> tuple[str, str, str]:
        if self.api_url:
            hub_match = re.match(
                r'^https?://huggingface\.co/(?:spaces/)?([^/]+/[^/]+)/?$', self.api_url.strip(), re.IGNORECASE
            )
            if hub_match:
                self.model_id = hub_match.group(1)
            elif re.match(r'^https?://[^/]+\.hf\.space/?$', self.api_url.strip(), re.IGNORECASE):
                self.model_id = self.api_url.strip()
            else:
                return self._call_http_endpoint(
                    person_image_path=person_image_path,
                    garment_image_path_or_url=garment_image_path_or_url,
                    category=category,
                    garment_description=garment_description,
                    denoise_steps=denoise_steps,
                    seed=seed,
                )
        return self._call_gradio_space(
            person_image_path=person_image_path,
            garment_image_path_or_url=garment_image_path_or_url,
            category=category,
            garment_description=garment_description,
            denoise_steps=denoise_steps,
            seed=seed,
        )

    def _save_output_bytes(self, content: bytes, ext: str = '.png') -> tuple[str, str]:
        out_dir = os.path.join(current_app.config['GENERATED_FOLDER'], 'tryon_images')
        os.makedirs(out_dir, exist_ok=True)
        filename = f'tryon_{uuid.uuid4().hex}{ext}'
        disk_path = os.path.join(out_dir, filename)
        with open(disk_path, 'wb') as f:
            f.write(content)
        return disk_path, f'/generated/tryon_images/{filename}'

    def _call_http_endpoint(
        self,
        person_image_path: str,
        garment_image_path_or_url: str,
        category: str,
        garment_description: str,
        denoise_steps: int,
        seed: int,
    ) -> tuple[str, str, str]:
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        garment_bytes: bytes
        if garment_image_path_or_url.startswith('http://') or garment_image_path_or_url.startswith('https://'):
            resp = requests.get(garment_image_path_or_url, timeout=30)
            if not resp.ok:
                raise HuggingFaceServiceError(f'Failed to download garment image ({resp.status_code}).', 400)
            garment_bytes = resp.content
        else:
            with open(garment_image_path_or_url, 'rb') as gf:
                garment_bytes = gf.read()

        with open(person_image_path, 'rb') as pf:
            person_bytes = pf.read()

        files = {
            'person_image': ('person.jpg', person_bytes, 'image/jpeg'),
            'garment_image': ('garment.jpg', garment_bytes, 'image/jpeg'),
        }
        data = {
            'category': category,
            'garment_description': garment_description,
            'denoise_steps': str(denoise_steps),
            'seed': str(seed),
        }

        for attempt in range(2):
            try:
                response = requests.post(self.api_url, headers=headers, files=files, data=data, timeout=120)
            except requests.Timeout as exc:
                raise HuggingFaceServiceError('Hugging Face endpoint timed out after 120 seconds.', 504) from exc
            except requests.RequestException as exc:
                raise HuggingFaceServiceError(f'Failed to connect to Hugging Face endpoint: {exc}', 502) from exc

            if response.status_code == 503 and attempt == 0:
                try:
                    wait_sec = min(int(response.json().get('estimated_time', 15)), 25)
                except ValueError:
                    wait_sec = 15
                time.sleep(wait_sec)
                continue

            if response.status_code == 429:
                raise HuggingFaceServiceError(
                    'Hugging Face rate limit reached. Configure HF_API_TOKEN or retry shortly.', 429
                )

            if not response.ok:
                raise HuggingFaceServiceError(
                    f'Hugging Face endpoint returned HTTP {response.status_code}: {response.text[:240]}',
                    503 if response.status_code >= 500 else 502,
                )

            content_type = response.headers.get('Content-Type', '')
            if content_type.startswith('image/'):
                ext = '.jpg' if 'jpeg' in content_type else '.png'
                disk_path, public_url = self._save_output_bytes(response.content, ext)
                return disk_path, public_url, self.model_id or self.api_url

            try:
                payload = response.json()
            except ValueError as exc:
                raise HuggingFaceServiceError('Invalid JSON response from Hugging Face endpoint.', 502) from exc

            img_val = payload.get('image') or payload.get('generated_image') or payload.get('output')
            if isinstance(img_val, str):
                if img_val.startswith('http://') or img_val.startswith('https://'):
                    img_resp = requests.get(img_val, headers=headers, timeout=30)
                    img_resp.raise_for_status()
                    disk_path, public_url = self._save_output_bytes(img_resp.content, '.png')
                    return disk_path, public_url, self.model_id or self.api_url
                if ',' in img_val:
                    img_val = img_val.split(',', 1)[1]
                disk_path, public_url = self._save_output_bytes(base64.b64decode(img_val), '.png')
                return disk_path, public_url, self.model_id or self.api_url

            raise HuggingFaceServiceError('Unexpected JSON structure returned by Hugging Face endpoint.', 502)

        raise HuggingFaceServiceError('Hugging Face model is warming up. Please retry.', 503)

    def _call_gradio_space(
        self,
        person_image_path: str,
        garment_image_path_or_url: str,
        category: str,
        garment_description: str,
        denoise_steps: int,
        seed: int,
    ) -> tuple[str, str, str]:
        try:
            from gradio_client import Client, handle_file
        except ImportError as exc:
            raise HuggingFaceServiceError(
                'gradio_client is not installed. Run pip install -r requirements.txt.', 500
            ) from exc

        try:
            client = Client(self.model_id, hf_token=self.token)
        except Exception as exc:
            raise HuggingFaceServiceError(
                f'Unable to connect to Hugging Face Space "{self.model_id}": {exc}', 503
            ) from exc

        try:
            lower = self.model_id.lower()
            if 'catvton' in lower:
                cloth_type = 'lower' if category == 'lower_body' else ('overall' if category == 'dresses' else 'upper')
                result = client.predict(
                    handle_file(person_image_path),
                    handle_file(garment_image_path_or_url),
                    cloth_type,
                    denoise_steps,
                    2.5,
                    seed,
                    'result only',
                    api_name='/submit_function',
                )
            elif 'ootdiffusion' in lower:
                oot_cat = (
                    'Lower-body'
                    if category == 'lower_body'
                    else ('Dress' if category == 'dresses' else 'Upper-body')
                )
                result = client.predict(
                    handle_file(person_image_path),
                    handle_file(garment_image_path_or_url),
                    oot_cat,
                    1,
                    denoise_steps,
                    2.0,
                    seed,
                    api_name='/process_dc',
                )
            else:
                result = client.predict(
                    dict={'background': handle_file(person_image_path), 'layers': [], 'composite': None},
                    garm_img=handle_file(garment_image_path_or_url),
                    garment_des=garment_description,
                    is_checked=True,
                    is_checked_crop=False,
                    denoise_steps=denoise_steps,
                    seed=seed,
                    api_name='/tryon',
                )
        except Exception as exc:
            msg = str(exc)
            status = 429 if 'quota' in msg.lower() or 'zerogpu' in msg.lower() else 502
            raise HuggingFaceServiceError(f'Hugging Face inference failed ({self.model_id}): {msg}', status) from exc

        output_item = result[0] if isinstance(result, (list, tuple)) else result
        local_generated = None
        if isinstance(output_item, str) and os.path.exists(output_item):
            local_generated = output_item
        elif isinstance(output_item, dict):
            path_or_url = output_item.get('path') or output_item.get('url')
            if path_or_url and os.path.exists(path_or_url):
                local_generated = path_or_url
            elif path_or_url and path_or_url.startswith('http'):
                resp = requests.get(path_or_url, timeout=30)
                resp.raise_for_status()
                disk_path, public_url = self._save_output_bytes(resp.content, '.png')
                return disk_path, public_url, self.model_id

        if not local_generated:
            raise HuggingFaceServiceError(
                f'Hugging Face Space "{self.model_id}" did not return an output image file.', 502
            )

        out_dir = os.path.join(current_app.config['GENERATED_FOLDER'], 'tryon_images')
        os.makedirs(out_dir, exist_ok=True)
        ext = os.path.splitext(local_generated)[1] or '.png'
        filename = f'tryon_{uuid.uuid4().hex}{ext}'
        disk_path = os.path.join(out_dir, filename)
        shutil.copyfile(local_generated, disk_path)
        return disk_path, f'/generated/tryon_images/{filename}', self.model_id
