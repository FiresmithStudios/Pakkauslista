import { useState, useRef, useEffect } from 'react';
import { preprocessForOcr, runOcr } from '../ocr-utils';
import ImageCropEditor from './ImageCropEditor';

interface AddPositionWithAiModalProps {
  nextPositionNumber: number;
  onSuccess: () => void;
  onCancel: () => void;
  onCreatePosition: (data: {
    positionNumber: number;
    name: string;
    totalQuantity: number;
    notes?: string;
  }) => Promise<void>;
}

type Step = 'capture' | 'identify' | 'processing';

export default function AddPositionWithAiModal({
  nextPositionNumber,
  onSuccess,
  onCancel,
  onCreatePosition,
}: AddPositionWithAiModalProps) {
  const [step, setStep] = useState<Step>('capture');
  const [images, setImages] = useState<string[]>([]);
  const [positionIdentifier, setPositionIdentifier] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cropImageIndex, setCropImageIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (cameraReady && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraReady]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kameran käyttöoikeus evätty');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError('Kamera ei valmis');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setImages((prev) => [...prev, canvas.toDataURL('image/png')]);
    streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (cropImageIndex === index) setCropImageIndex(null);
    else if (cropImageIndex != null && cropImageIndex > index) setCropImageIndex(cropImageIndex - 1);
  };

  const handleCrop = (index: number, croppedDataUrl: string) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = croppedDataUrl;
      return next;
    });
    setCropImageIndex(null);
  };

  const handleAnalyze = async () => {
    if (images.length === 0) {
      setError('Lisää vähintään yksi kuva');
      return;
    }
    setStep('processing');
    setProcessing(true);
    setError(null);
    setProgress('');

    try {
      const ocrTexts: string[] = [];
      for (let i = 0; i < images.length; i++) {
        setProgress(`Käsitellään kuva ${i + 1}/${images.length}...`);
        const processed = await preprocessForOcr(images[i]);
        setProgress(`OCR kuva ${i + 1}...`);
        const ocrResult = await runOcr(processed, (msg) => setProgress(msg));
        ocrTexts.push(ocrResult.text || '');
      }

      setProgress('AI analysoi...');
      const res = await fetch('/api/ai-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ocrTexts,
          positionIdentifier: positionIdentifier.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analyysi epäonnistui');

      await onCreatePosition({
        positionNumber: nextPositionNumber,
        name: data.name || positionIdentifier || `Positio ${nextPositionNumber}`,
        totalQuantity: data.totalQuantity || 0,
        notes: [
          data.notes,
          data.weight != null && `Paino: ${data.weight} kg`,
          data.volume != null && `Tilavuus: ${data.volume} cbm`,
        ]
          .filter(Boolean)
          .join('\n') || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Käsittely epäonnistui');
    } finally {
      setProcessing(false);
      setProgress('');
    }
  };

  const canProceedFromCapture = images.length > 0;
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>
          {step === 'capture' && 'Lisää positio AI:lla – Ota kuvat'}
          {step === 'identify' && 'Positiotunniste'}
          {step === 'processing' && 'Käsitellään...'}
        </h3>

        {error && <p style={styles.error}>{error}</p>}
        {processing && progress && <p style={styles.progress}>{progress}</p>}

        {step === 'capture' && (
          <>
            <p style={styles.hint}>
              Ota kuva position tiedoista tai lataa kuvat. Voit lisätä useita kuvia (esim. useampi sivu).
            </p>
            <div style={styles.captureRow}>
              <label style={styles.fileLabel}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                📁 Lataa kuvat
              </label>
              <button type="button" style={styles.camBtn} onClick={startCamera}>
                📷 Kamera
              </button>
            </div>
            {cameraReady && (
              <div style={styles.cameraBox}>
                <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
                <button type="button" style={styles.captureBtn} onClick={capturePhoto}>
                  Ota kuva
                </button>
              </div>
            )}
            {images.length > 0 && (
              <div style={styles.thumbnails}>
                {images.map((img, i) => (
                  <div key={i} style={styles.thumbWrap}>
                    <img
                      src={img}
                      alt={`Kuva ${i + 1}`}
                      style={styles.thumb}
                      onClick={() => setCropImageIndex(i)}
                      title="Klikkaa rajataksesi"
                    />
                    <button
                      type="button"
                      style={styles.removeBtn}
                      onClick={() => removeImage(i)}
                      aria-label="Poista"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {cropImageIndex != null && images[cropImageIndex] && (
              <ImageCropEditor
                imageSrc={images[cropImageIndex]}
                onCrop={(url) => handleCrop(cropImageIndex, url)}
                onCancel={() => setCropImageIndex(null)}
              />
            )}
            <div style={styles.actions}>
              <button type="button" style={styles.cancelBtn} onClick={onCancel}>
                Peruuta
              </button>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={() => setStep('identify')}
                disabled={!canProceedFromCapture}
              >
                Seuraava
              </button>
            </div>
          </>
        )}

        {step === 'identify' && (
          <>
            <p style={styles.hint}>
              Syötä position tunniste (nimi tai numero). AI käyttää sitä tunnistukseen.
            </p>
            <input
              type="text"
              value={positionIdentifier}
              onChange={(e) => setPositionIdentifier(e.target.value)}
              placeholder="Esim. Positio 1 tai Laatikko A1"
              style={styles.input}
            />
            <div style={styles.actions}>
              <button type="button" style={styles.cancelBtn} onClick={() => setStep('capture')}>
                Takaisin
              </button>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={handleAnalyze}
                disabled={processing}
              >
                {processing ? 'Käsitellään...' : 'Analysoi ja luo positio'}
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <p style={styles.muted}>Odota...</p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },
  modal: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius)',
    padding: 24,
    maxWidth: 440,
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow)',
  },
  title: {
    margin: '0 0 16px',
    fontSize: '1.25rem',
    fontWeight: 600,
  },
  hint: {
    margin: '0 0 16px',
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
  },
  error: {
    color: '#f87171',
    margin: '0 0 12px',
    fontSize: '0.9rem',
  },
  progress: {
    color: 'var(--color-accent)',
    margin: '0 0 12px',
    fontSize: '0.9rem',
  },
  captureRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  },
  fileLabel: {
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: 600,
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  },
  camBtn: {
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: 500,
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
  },
  cameraBox: {
    marginBottom: 16,
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    background: '#000',
  },
  video: {
    width: '100%',
    maxHeight: 240,
    display: 'block',
    objectFit: 'cover',
  },
  captureBtn: {
    display: 'block',
    width: '100%',
    padding: 14,
    fontSize: '1rem',
    fontWeight: 600,
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
  },
  thumbnails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: 72,
    height: 90,
    objectFit: 'cover',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#f87171',
    color: '#fff',
    border: 'none',
    fontSize: '1.1rem',
    lineHeight: 1,
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    marginBottom: 16,
    fontSize: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelBtn: {
    padding: '12px 20px',
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500,
  },
  primaryBtn: {
    padding: '12px 20px',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 600,
  },
  muted: {
    color: 'var(--color-text-muted)',
  },
};
