import { createWorker, PSM } from 'tesseract.js';

/** Otsu's method: find optimal threshold for binarization (black/white). */
function otsuThreshold(hist: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVar = 0;
  let bestThresh = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) ** 2;
    if (varBetween > maxVar) {
      maxVar = varBetween;
      bestThresh = t;
    }
  }
  return bestThresh;
}

/** High-accuracy preprocessing: scale up, grayscale, Otsu binarization, sharpen. */
export async function preprocessForOcr(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const targetDim = 3000;
      let w = img.width;
      let h = img.height;
      const long = Math.max(w, h);
      if (long < targetDim) {
        const scale = targetDim / long;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      } else if (long > targetDim) {
        const scale = targetDim / long;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.filter = 'grayscale(100%) contrast(1.3)';
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const hist = new Array(256).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        hist[Math.min(255, g)]++;
      }
      const thresh = otsuThreshold(hist, w * h);
      let blackCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const v = g >= thresh ? 255 : 0;
        if (v === 0) blackCount++;
        data[i] = data[i + 1] = data[i + 2] = v;
      }
      const totalPx = w * h;
      if (blackCount > totalPx / 2) {
        for (let i = 0; i < data.length; i += 4) {
          const v = data[i] === 0 ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = v;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
}

export interface OcrResult {
  text: string;
  confidence: number;
}

/** Run OCR with multiple PSM modes for maximum accuracy. Speed is not a priority. */
export async function runOcr(
  imageDataUrl: string,
  onProgress?: (msg: string) => void
): Promise<OcrResult> {
  const worker = await createWorker('fin+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(`OCR: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  const results: OcrResult[] = [];
  for (const psm of [PSM.SINGLE_BLOCK, PSM.AUTO] as const) {
    if (onProgress) onProgress(`OCR (tila ${psm})...`);
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    const { data } = await worker.recognize(imageDataUrl);
    const text = data.text?.trim() || '';
    const conf = data.confidence ?? 0;
    results.push({ text, confidence: conf });
  }
  await worker.terminate();

  const best = results.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  return best;
}
