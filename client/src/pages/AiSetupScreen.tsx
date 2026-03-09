import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOperator } from '../OperatorContext';
import { containersApi, positionsApi } from '../api';
import { preprocessForOcr, runOcr } from '../ocr-utils';

export interface ExtractedPosition {
  positionNumber: number;
  name: string;
  totalQuantity: number;
  weight: number;
  volume: number;
  packages?: { count: number; unit: string };
  notes?: string;
}

export interface ExtractedContainerInfo {
  containerNumber?: string | null;
  vessel?: string | null;
  etd?: string | null;
  eta?: string | null;
  polPod?: string | null;
}

type Step = 'container' | 'scan' | 'review';

export default function AiSetupScreen() {
  const { operatorName } = useOperator();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('container');
  const [containerNumber, setContainerNumber] = useState('');
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [positions, setPositions] = useState<ExtractedPosition[]>([]);
  const [containerInfo, setContainerInfo] = useState<ExtractedContainerInfo | null>(null);
  const [verification, setVerification] = useState<{
    verified: boolean;
    issues: Array<{ positionNumber: number | null; severity: string; message: string }>;
    suggestions: string[];
    summary: string;
  } | null>(null);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!operatorName) {
      navigate('/', { replace: true });
      return;
    }
  }, [operatorName, navigate]);

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

  useEffect(() => {
    if (!cameraReady || !streamRef.current || !videoRef.current || step !== 'scan') return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const onLoaded = () => video.play().catch(() => {});
    video.addEventListener('loadedmetadata', onLoaded);
    return () => video.removeEventListener('loadedmetadata', onLoaded);
  }, [step, cameraReady]);

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
    setPageImages((prev) => [...prev, dataUrl]);
    streamRef.current.getTracks().forEach((t) => t.stop());
    setCameraReady(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const readers: FileReader[] = [];
    let loaded = 0;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPageImages((prev) => [...prev, reader.result as string]);
        }
        loaded++;
      };
      reader.readAsDataURL(file);
      readers.push(reader);
    });
    e.target.value = '';
  };

  const removePage = (index: number) => {
    setPageImages((prev) => prev.filter((_, i) => i !== index));
  };

  const mergePositions = (
    existing: ExtractedPosition[],
    newPositions: ExtractedPosition[]
  ): ExtractedPosition[] => {
    const byNum = new Map<number, ExtractedPosition>();
    for (const p of existing) byNum.set(p.positionNumber, p);
    for (const p of newPositions) {
      const existingP = byNum.get(p.positionNumber);
      if (!existingP || (p.notes && p.notes.length > (existingP.notes?.length ?? 0))) {
        byNum.set(p.positionNumber, p);
      }
    }
    return Array.from(byNum.values()).sort((a, b) => a.positionNumber - b.positionNumber);
  };

  const processPages = async () => {
    if (pageImages.length === 0) {
      setError('Lisää vähintään yksi sivu.');
      return;
    }
    setProcessing(true);
    setError(null);
    setVerification(null);
    let allPositions: ExtractedPosition[] = [];
    let firstContainerInfo: ExtractedContainerInfo | null = null;

    try {
      for (let i = 0; i < pageImages.length; i++) {
        setProgress(`Käsitellään sivu ${i + 1}/${pageImages.length}...`);
        setProgress('Esikäsitellään kuvaa...');
        const processed = await preprocessForOcr(pageImages[i]);
        setProgress(`Luetaan tekstiä sivulta ${i + 1}...`);
        const ocrResult = await runOcr(processed, (msg) => setProgress(msg));
        if (!ocrResult.text.trim()) {
          setError(`Sivulta ${i + 1} ei löytynyt tekstiä. Kokeile selkeämpää kuvaa.`);
          setProcessing(false);
          return;
        }
        setProgress(`AI analysoi sivua ${i + 1}...`);
        const res = await fetch('/api/ai-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'extract', ocrText: ocrResult.text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Extract epäonnistui');
        if (data.positions?.length) {
          allPositions = mergePositions(allPositions, data.positions);
        }
        if (i === 0 && data.extractedContainerInfo) {
          firstContainerInfo = data.extractedContainerInfo;
          if (data.extractedContainerInfo.containerNumber && !containerNumber) {
            setContainerNumber(data.extractedContainerInfo.containerNumber);
          }
        }
      }
      setPositions(allPositions);
      setContainerInfo(firstContainerInfo);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Käsittely epäonnistui');
    } finally {
      setProcessing(false);
      setProgress('');
    }
  };

  const runVerification = async () => {
    if (positions.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      setProgress('Vahvistetaan dataa...');
      const res = await fetch('/api/ai-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'verify',
          positions,
          containerNumber: containerNumber || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vahvistus epäonnistui');
      setVerification(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vahvistus epäonnistui');
    } finally {
      setProcessing(false);
      setProgress('');
    }
  };

  const createContainerAndPositions = async () => {
    const num = containerNumber.trim();
    if (!num || positions.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      let container = await containersApi.getByNumber(num).catch(() => null);
      if (!container) {
        container = await containersApi.create(num);
      }
      const notesLines = (p: ExtractedPosition) =>
        [
          p.notes,
          p.weight != null && `Paino: ${p.weight} kg`,
          p.volume != null && `Tilavuus: ${p.volume} cbm`,
          p.packages && `${p.packages.count} ${p.packages.unit}`,
        ]
          .filter(Boolean)
          .join('\n');
      await Promise.all(
        positions.map((p) =>
          positionsApi.create({
            containerId: container!.id,
            positionNumber: p.positionNumber,
            name: p.name,
            totalQuantity: p.totalQuantity,
            notes: notesLines(p) || undefined,
          })
        )
      );
      navigate(`/containers/${container.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kontin luonti epäonnistui');
    } finally {
      setProcessing(false);
    }
  };

  const goBackToScan = () => {
    setStep('scan');
    setVerification(null);
  };

  const goBackToContainer = () => {
    setStep('container');
    setPageImages([]);
    setPositions([]);
    setContainerInfo(null);
    setVerification(null);
  };

  if (!operatorName) return null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate('/containers')}>
          ← Takaisin
        </button>
        <h1 style={styles.title}>AI-kontin luonti</h1>
        <p style={styles.subtitle}>
          Skannaa purkulistan sivut – AI luo positiot automaattisesti
        </p>
      </header>

      {error && <p style={styles.error}>{error}</p>}
      {processing && progress && <p style={styles.progress}>{progress}</p>}

      {step === 'container' && (
        <div style={styles.section}>
          <label style={styles.label}>Kontin numero</label>
          <input
            type="text"
            value={containerNumber}
            onChange={(e) => setContainerNumber(e.target.value)}
            style={styles.input}
            placeholder="Esim. CSNU6403657 tai F1393964"
          />
          <p style={styles.hint}>
            Voit jättää tyhjäksi – ensimmäiseltä sivulta yritetään lukea automaattisesti.
          </p>
          <button style={styles.primaryBtn} onClick={() => setStep('scan')}>
            {containerNumber.trim() ? 'Jatka skannaukseen' : 'Skannaa ensin, täytä myöhemmin'}
          </button>
        </div>
      )}

      {step === 'scan' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Lisää sivuja</h3>
          <p style={styles.hint}>
            Ota kuva jokaisesta purkulistan sivusta tai lataa kuvat. Sininen ympyröity numero =
            positio.
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
            <button style={styles.secondaryBtn} onClick={startCamera}>
              📷 Avaa kamera
            </button>
          </div>

          {cameraReady && (
            <div style={styles.cameraView}>
              <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
              <button style={styles.captureBtn} onClick={capturePhoto}>
                Ota kuva
              </button>
            </div>
          )}

          {pageImages.length > 0 && (
            <>
              <p style={styles.pageCount}>Sivuja: {pageImages.length}</p>
              <div style={styles.thumbnails}>
                {pageImages.map((img, i) => (
                  <div key={i} style={styles.thumbWrap}>
                    <img src={img} alt={`Sivu ${i + 1}`} style={styles.thumb} />
                    <button
                      style={styles.removeThumb}
                      onClick={() => removePage(i)}
                      aria-label="Poista"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div style={styles.actions}>
                <button
                  style={styles.primaryBtn}
                  onClick={processPages}
                  disabled={processing}
                >
                  {processing ? 'Käsitellään...' : 'Analysoi sivut AI:lla'}
                </button>
                <button style={styles.secondaryBtn} onClick={goBackToContainer}>
                  Aloita alusta
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'review' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Tarkista positiot</h3>
          <p style={styles.hint}>
            {positions.length} positiota löytyi. Tarkista ja vahvista ennen luontia.
          </p>

          <div style={styles.containerEdit}>
            <label style={styles.label}>Kontin numero</label>
            <input
              type="text"
              value={containerNumber}
              onChange={(e) => setContainerNumber(e.target.value)}
              style={styles.input}
              placeholder="Esim. CSNU6403657"
            />
          </div>

          <button
            style={styles.verifyBtn}
            onClick={runVerification}
            disabled={processing || positions.length === 0}
          >
            {processing ? 'Vahvistetaan...' : '✓ Vahvista AI:lla (tarkista duplikaatit, puuttuvat kentät)'}
          </button>

          {verification && (
            <div style={styles.verificationCard}>
              <h4 style={styles.verificationTitle}>
                {verification.verified ? '✓ Vahvistus OK' : '⚠ Huomioitavaa'}
              </h4>
              <p style={styles.verificationSummary}>{verification.summary}</p>
              {verification.issues?.length > 0 && (
                <ul style={styles.issuesList}>
                  {verification.issues.map((issue, i) => (
                    <li key={i} style={styles.issueItem}>
                      <span style={issue.severity === 'error' ? styles.issueError : styles.issueWarn}>
                        Pos. {issue.positionNumber ?? '?'}: {issue.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {verification.suggestions?.length > 0 && (
                <ul style={styles.suggestionsList}>
                  {verification.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div style={styles.positionList}>
            {positions.map((p) => (
              <div key={p.positionNumber} style={styles.positionCard}>
                <div style={styles.positionHeader}>
                  <span style={styles.positionNum}>#{p.positionNumber}</span>
                  <span style={styles.positionName}>{p.name}</span>
                </div>
                <div style={styles.positionMeta}>
                  {p.totalQuantity} kpl · {p.weight} kg · {p.volume} cbm
                  {p.packages && ` · ${p.packages.count} ${p.packages.unit}`}
                </div>
                {p.notes && (
                  <pre style={styles.positionNotes}>{p.notes}</pre>
                )}
              </div>
            ))}
          </div>

          <div style={styles.actions}>
            <button
              style={styles.primaryBtn}
              onClick={createContainerAndPositions}
              disabled={processing || !containerNumber.trim()}
            >
              {processing ? 'Luodaan...' : 'Luo kontti ja positiot'}
            </button>
            <button style={styles.secondaryBtn} onClick={goBackToScan}>
              Takaisin skannaukseen
            </button>
          </div>
        </div>
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
  progress: {
    color: 'var(--color-accent)',
    margin: '0 0 16px',
    fontSize: '0.9rem',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: '1.1rem',
    fontWeight: 600,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    marginBottom: 8,
    fontSize: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  hint: {
    margin: '0 0 16px',
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
  },
  primaryBtn: {
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    marginBottom: 12,
  },
  secondaryBtn: {
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    fontSize: '1rem',
    fontWeight: 500,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    marginBottom: 12,
  },
  captureRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  fileLabel: {
    display: 'inline-block',
    padding: '14px 24px',
    fontSize: '1rem',
    fontWeight: 600,
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  },
  cameraView: {
    marginBottom: 16,
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    background: '#000',
  },
  video: {
    width: '100%',
    minHeight: 300,
    maxHeight: '50vh',
    display: 'block',
    objectFit: 'cover',
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
  pageCount: {
    margin: '16px 0 8px',
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  thumbnails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: 80,
    height: 100,
    objectFit: 'cover',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
  },
  removeThumb: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#f87171',
    color: '#fff',
    border: 'none',
    fontSize: '1.2rem',
    lineHeight: 1,
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
  },
  containerEdit: {
    marginBottom: 16,
  },
  verifyBtn: {
    padding: '12px 20px',
    fontSize: '0.95rem',
    fontWeight: 500,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    marginBottom: 16,
  },
  verificationCard: {
    padding: 16,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: 24,
    border: '2px solid var(--color-surface-hover)',
  },
  verificationTitle: {
    margin: '0 0 8px',
    fontSize: '1rem',
    fontWeight: 600,
  },
  verificationSummary: {
    margin: '0 0 12px',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: 'var(--color-text-muted)',
  },
  issuesList: {
    margin: '0 0 12px',
    paddingLeft: 20,
  },
  issueItem: {
    marginBottom: 4,
  },
  issueError: {
    color: '#f87171',
  },
  issueWarn: {
    color: '#fbbf24',
  },
  suggestionsList: {
    margin: 0,
    paddingLeft: 20,
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
  },
  positionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  positionCard: {
    padding: 16,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
  },
  positionHeader: {
    display: 'flex',
    gap: 12,
    alignItems: 'baseline',
    marginBottom: 8,
  },
  positionNum: {
    fontWeight: 700,
    color: 'var(--color-accent)',
    fontSize: '1.1rem',
  },
  positionName: {
    flex: 1,
    fontSize: '1rem',
    fontWeight: 500,
  },
  positionMeta: {
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
    marginBottom: 8,
  },
  positionNotes: {
    margin: 0,
    padding: 12,
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'auto',
    maxHeight: 100,
  },
};
