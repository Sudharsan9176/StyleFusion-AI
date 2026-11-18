import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client, handle_file } from '@gradio/client';
import { ROOT_DIR, TRYON_OUTPUT_DIR } from './db.ts';

export interface TryOnRequest {
  personImagePath: string;
  garmentImagePathOrUrl: string;
  garmentDescription: string;
  category: 'upper_body' | 'lower_body' | 'dresses';
  denoiseSteps?: number;
  seed?: number;
}

export interface TryOnResult {
  generatedImageUrl: string;
  generatedFilePath: string;
  modelName: string;
}

export class HuggingFaceTryOnError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'HuggingFaceTryOnError';
    this.statusCode = statusCode;
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function getExtensionFromContentType(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes('webp')) return '.webp';
  if (lower.includes('jpeg') || lower.includes('jpg')) return '.jpg';
  return '.png';
}

function resolveLocalPath(pathOrUrl: string): string | null {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return null;
  }
  const clean = pathOrUrl.replace(/^\/+/, '');
  const candidateRoot = path.resolve(ROOT_DIR, clean);
  if (fs.existsSync(candidateRoot)) {
    return candidateRoot;
  }
  const candidateBackend = path.resolve(ROOT_DIR, 'backend', clean);
  if (fs.existsSync(candidateBackend)) {
    return candidateBackend;
  }
  return null;
}

async function loadImageBlob(pathOrUrl: string): Promise<{ blob: Blob; filename: string }> {
  const localFile = resolveLocalPath(pathOrUrl);
  if (localFile) {
    const buffer = fs.readFileSync(localFile);
    const mime = getMimeType(localFile);
    return {
      blob: new Blob([buffer], { type: mime }),
      filename: path.basename(localFile),
    };
  }
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const res = await fetch(pathOrUrl);
    if (!res.ok) {
      throw new HuggingFaceTryOnError(`Failed to fetch garment image (${res.status})`, 400);
    }
    const arr = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return {
      blob: new Blob([arr], { type: contentType }),
      filename: 'garment.jpg',
    };
  }
  throw new HuggingFaceTryOnError(`Garment or person image not found: ${pathOrUrl}`, 404);
}

async function saveGeneratedBuffer(buffer: Buffer, ext = '.png'): Promise<{ filePath: string; url: string }> {
  const filename = `tryon_${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(TRYON_OUTPUT_DIR, filename);
  fs.writeFileSync(fullPath, buffer);
  return {
    filePath: fullPath,
    url: `/generated/tryon_images/${filename}`,
  };
}

function resolveTarget(
  configuredModelId?: string,
  configuredApiUrl?: string
): { mode: 'gradio'; target: string; displayModel: string } | { mode: 'http'; apiUrl: string; displayModel: string } {
  const modelId = configuredModelId?.trim() || 'yisol/IDM-VTON';
  const apiUrl = configuredApiUrl?.trim();

  if (!apiUrl) {
    return { mode: 'gradio', target: modelId, displayModel: modelId };
  }

  // Handle Hugging Face Hub URLs pasted into HF_API_URL (e.g. https://huggingface.co/levihsu/OOTDiffusion or https://huggingface.co/spaces/yisol/IDM-VTON)
  const hfHubMatch = apiUrl.match(/^https?:\/\/huggingface\.co\/(?:spaces\/)?([^/]+\/[^/]+)\/?$/i);
  if (hfHubMatch) {
    const extractedId = hfHubMatch[1];
    return { mode: 'gradio', target: extractedId, displayModel: extractedId };
  }

  // Handle direct *.hf.space Gradio URLs
  if (/^https?:\/\/[^/]+\.hf\.space\/?$/i.test(apiUrl)) {
    return { mode: 'gradio', target: apiUrl, displayModel: modelId };
  }

  // Handle raw HTTP REST inference endpoints (HF Inference Endpoints, router.huggingface.co, self-hosted GPU)
  return { mode: 'http', apiUrl, displayModel: modelId || apiUrl };
}

async function callCustomHttpEndpoint(
  req: TryOnRequest,
  apiUrl: string,
  displayModel: string,
  token?: string
): Promise<TryOnResult> {
  const person = await loadImageBlob(req.personImagePath);
  const garment = await loadImageBlob(req.garmentImagePathOrUrl);

  const form = new FormData();
  form.append('person_image', person.blob, person.filename);
  form.append('garment_image', garment.blob, garment.filename);
  form.append('category', req.category);
  form.append('garment_description', req.garmentDescription);
  form.append('denoise_steps', String(req.denoiseSteps ?? 30));
  form.append('seed', String(req.seed ?? 42));

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      });

      if (response.status === 503 && attempt < maxAttempts) {
        const body = await response.json().catch(() => ({} as Record<string, unknown>));
        const waitSec = Math.min(Number(body.estimated_time || 15), 25);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }

      if (response.status === 429) {
        throw new HuggingFaceTryOnError(
          'Hugging Face API rate limit reached. Please wait a moment or configure a dedicated HF_API_TOKEN.',
          429
        );
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new HuggingFaceTryOnError(
          `Hugging Face endpoint returned ${response.status}: ${text.slice(0, 240) || response.statusText}`,
          response.status >= 500 ? 503 : 502
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        const buf = Buffer.from(await response.arrayBuffer());
        const ext = getExtensionFromContentType(contentType);
        const saved = await saveGeneratedBuffer(buf, ext);
        return {
          generatedImageUrl: saved.url,
          generatedFilePath: saved.filePath,
          modelName: displayModel,
        };
      }

      const json = (await response.json()) as Record<string, unknown>;
      const b64 =
        (json.image as string) ||
        (json.generated_image as string) ||
        (json.output as string);
      if (typeof b64 === 'string') {
        if (b64.startsWith('http://') || b64.startsWith('https://')) {
          const imgRes = await fetch(b64, { headers });
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const saved = await saveGeneratedBuffer(buf, getExtensionFromContentType(imgRes.headers.get('content-type') || 'image/png'));
          return {
            generatedImageUrl: saved.url,
            generatedFilePath: saved.filePath,
            modelName: displayModel,
          };
        }
        const cleaned = b64.replace(/^data:image\/\w+;base64,/, '');
        const saved = await saveGeneratedBuffer(Buffer.from(cleaned, 'base64'), '.png');
        return {
          generatedImageUrl: saved.url,
          generatedFilePath: saved.filePath,
          modelName: displayModel,
        };
      }

      throw new HuggingFaceTryOnError('Unexpected response format from Hugging Face endpoint.', 502);
    } catch (err) {
      if (err instanceof HuggingFaceTryOnError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new HuggingFaceTryOnError('Hugging Face inference request timed out after 120 seconds.', 504);
      }
      throw new HuggingFaceTryOnError(`Failed to reach Hugging Face endpoint: ${(err as Error).message}`, 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new HuggingFaceTryOnError('Hugging Face model is currently warming up. Please retry shortly.', 503);
}

async function callGradioSpace(
  req: TryOnRequest,
  spaceTarget: string,
  displayModel: string,
  token?: string
): Promise<TryOnResult> {
  const person = await loadImageBlob(req.personImagePath);
  const garment = await loadImageBlob(req.garmentImagePathOrUrl);

  let client: Awaited<ReturnType<typeof Client.connect>>;
  try {
    client = await Client.connect(spaceTarget, token ? { hf_token: token as `hf_${string}` } : undefined);
  } catch (err) {
    throw new HuggingFaceTryOnError(
      `Unable to connect to Hugging Face Space "${spaceTarget}": ${(err as Error).message}`,
      503
    );
  }

  let result: { data: unknown };
  try {
    const lowerModel = `${spaceTarget} ${displayModel}`.toLowerCase();
    if (lowerModel.includes('catvton')) {
      const clothType =
        req.category === 'lower_body' ? 'lower' : req.category === 'dresses' ? 'overall' : 'upper';
      result = await client.predict('/submit_function', [
        handle_file(person.blob),
        handle_file(garment.blob),
        clothType,
        req.denoiseSteps ?? 30,
        2.5,
        req.seed ?? 42,
        'result only',
      ]);
    } else if (lowerModel.includes('ootdiffusion')) {
      const cat =
        req.category === 'lower_body'
          ? 'Lower-body'
          : req.category === 'dresses'
          ? 'Dress'
          : 'Upper-body';
      const steps = Math.min(40, Math.max(20, req.denoiseSteps ?? 20));
      result = await client.predict('/process_dc', {
        vton_img: handle_file(person.blob),
        garm_img: handle_file(garment.blob),
        category: cat,
        n_samples: 1,
        n_steps: steps,
        image_scale: 2.0,
        seed: req.seed ?? 42,
      });
    } else {
      // Standard yisol/IDM-VTON Space signature
      result = await client.predict('/tryon', [
        { background: handle_file(person.blob), layers: [], composite: null },
        handle_file(garment.blob),
        req.garmentDescription || 'Fashion garment',
        true,
        false,
        req.denoiseSteps ?? 30,
        req.seed ?? 42,
      ]);
    }
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('zerogpu')) {
      throw new HuggingFaceTryOnError(
        `Hugging Face Space "${displayModel}" ZeroGPU quota reached. Please wait or use a Hugging Face Pro token.`,
        429
      );
    }
    throw new HuggingFaceTryOnError(`Hugging Face inference failed (${displayModel}): ${msg}`, 502);
  }

  const dataArr = Array.isArray(result.data) ? result.data : [result.data];
  const firstOutput = dataArr[0] as Record<string, unknown> | string | Array<Record<string, unknown>>;

  let outputUrl: string | null = null;
  if (typeof firstOutput === 'string') {
    outputUrl = firstOutput;
  } else if (Array.isArray(firstOutput) && firstOutput[0]) {
    const item = firstOutput[0] as Record<string, unknown>;
    outputUrl = (item.url as string) || ((item.image as Record<string, unknown>)?.url as string) || null;
  } else if (firstOutput && typeof firstOutput === 'object') {
    const obj = firstOutput as Record<string, unknown>;
    outputUrl =
      (obj.url as string) ||
      ((obj.image as Record<string, unknown>)?.url as string) ||
      null;
  }

  if (!outputUrl) {
    throw new HuggingFaceTryOnError(
      `Hugging Face Space "${displayModel}" returned no output image. Verify Space availability and input photos.`,
      502
    );
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const imgResponse = await fetch(outputUrl, { headers });
  if (!imgResponse.ok) {
    throw new HuggingFaceTryOnError(`Failed to download generated image from Hugging Face (${imgResponse.status})`, 502);
  }
  const buffer = Buffer.from(await imgResponse.arrayBuffer());
  const contentType = imgResponse.headers.get('content-type') || 'image/png';
  const ext = getExtensionFromContentType(contentType);
  const saved = await saveGeneratedBuffer(buffer, ext);

  return {
    generatedImageUrl: saved.url,
    generatedFilePath: saved.filePath,
    modelName: displayModel,
  };
}

export async function runVirtualTryOn(req: TryOnRequest): Promise<TryOnResult> {
  const token = process.env.HF_API_TOKEN?.trim() || undefined;
  const resolved = resolveTarget(process.env.HF_MODEL_ID, process.env.HF_API_URL);

  if (resolved.mode === 'http') {
    return callCustomHttpEndpoint(req, resolved.apiUrl, resolved.displayModel, token);
  }

  return callGradioSpace(req, resolved.target, resolved.displayModel, token);
}
