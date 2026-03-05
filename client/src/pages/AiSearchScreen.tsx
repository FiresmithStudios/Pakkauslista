import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOperator } from '../OperatorContext';
import { positionsApi } from '../api';
import type { PositionWithContainer } from '../store';

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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
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
    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: capturedImage,
          positions: positions.map((p) => ({
            id: p.id,
            containerNumber: p.containerNumber,
            positionNumber: p.positionNumber,
            name: p.name,
            totalQuantity: p.totalQuantity,
            packedQuantity: p.packedQuantity,
            description: p.description,
            weight: p.weight,
            volume: p.volume,
          })),
        }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error('Palvelin ei vastaa. Varmista että palvelin on käynnissä (npm run dev tai npm run start).');
        }
        if (res.status >= 500) {
          throw new Error('Palvelinvirhe. Yritä uudelleen hetken kuluttua.');
        }
        throw new Error('Palvelin palautti virheellisen vastauksen. Yritä uudelleen.');
      }
      if (!res.ok) throw new Error(data.error || 'Haku epäonnistui');
      setResult(data);
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
                  {searching ? 'Haku käynnissä...' : 'Hae position'}
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
