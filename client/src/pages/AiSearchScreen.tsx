import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWorker, PSM } from 'tesseract.js';
import { useOperator } from '../OperatorContext';
import { positionsApi } from '../api';
import type { PositionWithContainer } from '../store';

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
async function preprocessForOcr(imageDataUrl: string): Promise<string> {
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

interface AiSearchResult {
  labelText: string;
  positionId: string | null;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  whyNotOthers: string;
}

export default function AiSearchScreen() {
  const { operatorName } = useOperator();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [positions, setPositions] = useState<PositionWithContainer[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [result, setResult] = useState<AiSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!operatorName) {
      navigate('/', { replace: true });
      return;
    }
  }, [operatorName, navigate]);

  useEffect(() => {
    positionsApi.listAllWithContainers().then(setPositions).finally(() => setLoadingPositions(false));
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
      });
      streamRef.current = stream;
      setCameraReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kameran käyttöoikeus evätty');
    }
  };

  // Set video srcObject after React has rendered the video element (critical for iOS)
  useEffect(() => {
    if (!cameraReady || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const onLoaded = () => video.play().catch(() => {});
    video.addEventListener('loadedmetadata', onLoaded);
    return () => video.removeEventListener('loadedmetadata', onLoaded);
  }, [cameraReady]);

  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError('Kamera ei ole vielä valmis. Odota hetki ja yritä uudelleen.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    setCapturedImage(dataUrl);
    streamRef.current.getTracks().forEach((t) => t.stop());
    setCameraReady(false);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setResult(null);
    startCamera();
  };

  const runSearch = async () => {
    if (!capturedImage || positions.length === 0) return;
    setSearching(true);
    setError(null);
    setResult(null);
    setOcrProgress('');
    try {
      setOcrProgress('Käsitellään kuvaa...');
      const processedImage = await preprocessForOcr(capturedImage);
      setOcrProgress('Luetaan tekstiä kuvasta...');
      const worker = await createWorker('fin+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setOcrProgress(`OCR: ${Math.round(m.progress * 100)}%`);
        },
      });
      const results: { text: string; conf: number }[] = [];
      for (const psm of [PSM.SINGLE_BLOCK, PSM.AUTO] as const) {
        await worker.setParameters({ tessedit_pageseg_mode: psm });
        const { data } = await worker.recognize(processedImage);
        const text = data.text?.trim() || '';
        const conf = data.confidence ?? 0;
        results.push({ text, conf });
      }
      await worker.terminate();
      const best = results.reduce((a, b) => (a.conf > b.conf ? a : b));
      const labelText = best.text;
      if (!labelText) {
        setError('Kuvasta ei löytynyt tekstiä. Kokeile selkeämpää kuvaa hyvällä valaistuksella.');
        setSearching(false);
        return;
      }
      setOcrProgress('Haetaan AI-tulosta...');
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labelText,
          positions: positions.map((p) => ({
            id: p.id,
            containerNumber: p.containerNumber,
            positionNumber: p.positionNumber,
            name: p.name,
            totalQuantity: p.totalQuantity,
            packedQuantity: p.packedQuantity,
            notes: p.notes,
          })),
        }),
      });
      const text = await res.text();
      let apiData: AiSearchResult;
      try {
        apiData = JSON.parse(text) as AiSearchResult;
      } catch {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error('Palvelin ei vastaa. Yritä uudelleen hetken kuluttua.');
        }
        if (res.status >= 500) {
          throw new Error('Palvelinvirhe. Yritä uudelleen hetken kuluttua.');
        }
        throw new Error('Palvelin palautti virheellisen vastauksen. Yritä uudelleen.');
      }
      if (!res.ok) throw new Error((apiData as { error?: string }).error || 'Haku epäonnistui');
      setResult(apiData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Haku epäonnistui');
    } finally {
      setSearching(false);
    }
  };

  const goToPosition = (positionId: string) => {
    const p = positions.find((x) => x.id === positionId);
    if (p) navigate(`/containers/${p.containerId}/positions/${p.id}`);
  };

  if (!operatorName) return null;

  const matchedPosition = result?.positionId
    ? positions.find((p) => p.id === result.positionId)
    : null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate('/containers')}>
          ← Takaisin
        </button>
        <h1 style={styles.title}>AI-tuotehaku</h1>
        <p style={styles.subtitle}>
          Ota kuva tuotteen etiketistä – AI tunnistaa oikean position
        </p>
      </header>

      {error && <p style={styles.error}>{error}</p>}

      {loadingPositions ? (
        <p style={styles.muted}>Ladataan positioita...</p>
      ) : positions.length === 0 ? (
        <p style={styles.muted}>Ei avoimia positioita. Luo ensin kontti ja positiot.</p>
      ) : (
        <>
          {!capturedImage ? (
            <div style={styles.cameraSection}>
              {!cameraReady ? (
                <div style={styles.cameraPlaceholder}>
                  <p style={styles.cameraHint}>
                    Ota kuva tuotteen etiketistä. Varmista hyvä valaistus ja tarkkuus.
                  </p>
                  <label style={styles.fileLabelPrimary}>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => setCapturedImage(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                        e.target.value = '';
                      }}
                    />
                    📷 Ota kuva (suositus puhelimella)
                  </label>
                  <p style={styles.orText}>tai</p>
                  <button style={styles.secondaryBtn} onClick={startCamera}>
                    Avaa live-kamera
                  </button>
                </div>
              ) : (
                <div style={styles.cameraView}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={styles.video}
                  />
                  <button style={styles.captureBtn} onClick={capturePhoto}>
                    Ota kuva
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={styles.previewSection}>
              <img src={capturedImage} alt="Captured label" style={styles.previewImg} />
              <div style={styles.previewActions}>
                <button style={styles.secondaryBtn} onClick={retakePhoto} disabled={searching}>
                  Ota uusi kuva
                </button>
                <button
                  style={styles.primaryBtn}
                  onClick={runSearch}
                  disabled={searching}
                >
                  {searching ? (ocrProgress || 'Haku käynnissä...') : 'Hae position'}
                </button>
              </div>

              {result && (
                <div style={styles.resultCard}>
                  <h3 style={styles.resultTitle}>OCR-teksti</h3>
                  <pre style={styles.ocrText}>{result.labelText || '(ei tekstiä)'}</pre>

                  <h3 style={styles.resultTitle}>Tulos</h3>
                  <p style={styles.explanation}>{result.explanation}</p>
                  <p style={styles.whyNot}>{result.whyNotOthers}</p>

                  {matchedPosition ? (
                    <div style={styles.matchCard}>
                      <span style={styles.confidence}>
                        Luottamus: {result.confidence === 'high' ? 'Korkea' : result.confidence === 'medium' ? 'Keskitaso' : 'Matala'}
                      </span>
                      <div style={styles.matchInfo}>
                        <strong>{matchedPosition.containerNumber}</strong> – Positio #{matchedPosition.positionNumber}: {matchedPosition.name}
                      </div>
                      <button
                        style={styles.goBtn}
                        onClick={() => goToPosition(matchedPosition.id)}
                      >
                        Siirry positioon →
                      </button>
                    </div>
                  ) : (
                    <p style={styles.noMatch}>Ei löytynyt vastaavaa positiota.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    background: 'none',
    color: 'var(--color-accent)',
    fontWeight: 500,
    marginBottom: 8,
    padding: 8,
    fontSize: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  subtitle: {
    margin: '8px 0 0',
    color: 'var(--color-text-muted)',
    fontSize: '0.95rem',
  },
  error: {
    color: '#f87171',
    margin: '0 0 16px',
    fontSize: '0.9rem',
  },
  muted: {
    color: 'var(--color-text-muted)',
    fontSize: '0.95rem',
  },
  cameraSection: {
    marginTop: 16,
  },
  cameraPlaceholder: {
    padding: 32,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    textAlign: 'center',
  },
  cameraHint: {
    margin: '0 0 24px',
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
  },
  cameraView: {
    position: 'relative',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    background: '#000',
  },
  video: {
    width: '100%',
    minHeight: 300,
    maxHeight: '60vh',
    display: 'block',
    objectFit: 'cover',
    backgroundColor: '#000',
  },
  captureBtn: {
    display: 'block',
    width: '100%',
    padding: 18,
    fontSize: '1.125rem',
    fontWeight: 600,
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
  },
  primaryBtn: {
    padding: '14px 24px',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    marginBottom: 12,
  },
  secondaryBtn: {
    padding: '14px 24px',
    fontSize: '1rem',
    fontWeight: 500,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    marginRight: 12,
  },
  fileLabelPrimary: {
    display: 'inline-block',
    padding: '16px 24px',
    fontSize: '1.1rem',
    fontWeight: 600,
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    marginBottom: 12,
  },
  orText: {
    margin: '12px 0',
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem',
  },
  fileLabel: {
    display: 'block',
    fontSize: '0.95rem',
    color: 'var(--color-accent)',
    cursor: 'pointer',
    marginTop: 8,
  },
  previewSection: {
    marginTop: 16,
  },
  previewImg: {
    width: '100%',
    maxHeight: 300,
    objectFit: 'contain',
    borderRadius: 'var(--radius-sm)',
    background: '#000',
    marginBottom: 16,
  },
  previewActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  resultCard: {
    padding: 20,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    marginTop: 16,
  },
  resultTitle: {
    margin: '0 0 8px',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  },
  ocrText: {
    margin: '0 0 20px',
    padding: 12,
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'auto',
    maxHeight: 120,
  },
  explanation: {
    margin: '0 0 12px',
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  whyNot: {
    margin: '0 0 16px',
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
  },
  matchCard: {
    padding: 16,
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-accent)',
  },
  confidence: {
    display: 'block',
    fontSize: '0.85rem',
    color: 'var(--color-accent)',
    marginBottom: 8,
  },
  matchInfo: {
    marginBottom: 12,
    fontSize: '1rem',
  },
  goBtn: {
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
  },
  noMatch: {
    margin: 0,
    color: 'var(--color-text-muted)',
    fontStyle: 'italic',
  },
};
