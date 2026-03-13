import { useState, useRef, useEffect } from 'react';

interface ImageCropEditorProps {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export default function ImageCropEditor({ imageSrc, onCrop, onCancel }: ImageCropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, crop: { x: 0, y: 0, w: 0, h: 0 } });

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.width, h: img.height });
    img.src = imageSrc;
  }, [imageSrc]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      crop: { ...crop },
    };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = ((e.clientX - dragStart.current.x) / (containerRef.current?.clientWidth ?? 1)) * 100;
      const dy = ((e.clientY - dragStart.current.y) / (containerRef.current?.clientHeight ?? 1)) * 100;
      setCrop({
        x: Math.max(0, Math.min(100 - crop.w, dragStart.current.crop.x + dx)),
        y: Math.max(0, Math.min(100 - crop.h, dragStart.current.crop.y + dy)),
        w: dragStart.current.crop.w,
        h: dragStart.current.crop.h,
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, crop.w, crop.h]);

  const handleResize = (corner: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, crop: { ...crop } };
    const onMove = (ev: MouseEvent) => {
      const dx = ((ev.clientX - start.x) / (containerRef.current?.clientWidth ?? 1)) * 100;
      const dy = ((ev.clientY - start.y) / (containerRef.current?.clientHeight ?? 1)) * 100;
      if (corner === 'se') {
        setCrop({
          ...crop,
          w: Math.max(10, Math.min(100 - crop.x, start.crop.w + dx)),
          h: Math.max(10, Math.min(100 - crop.y, start.crop.h + dy)),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const doCrop = () => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    const canvas = document.createElement('canvas');
    const scaleX = imgSize.w / 100;
    const scaleY = imgSize.h / 100;
    canvas.width = crop.w * scaleX;
    canvas.height = crop.h * scaleY;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      img,
      (crop.x / 100) * imgSize.w,
      (crop.y / 100) * imgSize.h,
      (crop.w / 100) * imgSize.w,
      (crop.h / 100) * imgSize.h,
      0,
      0,
      canvas.width,
      canvas.height
    );
    onCrop(canvas.toDataURL('image/png'));
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h4 style={styles.title}>Rajaa kuva</h4>
        <p style={styles.hint}>Vedä laatikkoa siirtääksesi, kulmia muuttaaksesi kokoa</p>
        <div
          ref={containerRef}
          style={styles.cropContainer}
          onMouseDown={handleMouseDown}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop"
            style={styles.img}
            draggable={false}
          />
          <div
            style={{
              position: 'absolute',
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.w}%`,
              height: `${crop.h}%`,
              border: '3px solid var(--color-accent)',
              cursor: dragging ? 'grabbing' : 'grab',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 16,
                height: 16,
                background: 'var(--color-accent)',
                cursor: 'nwse-resize',
              }}
              onMouseDown={(e) => handleResize('se', e)}
            />
          </div>
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.cancelBtn} onClick={onCancel}>
            Peruuta
          </button>
          <button type="button" style={styles.okBtn} onClick={doCrop}>
            Käytä
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  modal: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius)',
    padding: 16,
    maxWidth: '95vw',
    maxHeight: '90vh',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '1.1rem',
  },
  hint: {
    margin: '0 0 12px',
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
  },
  cropContainer: {
    position: 'relative',
    width: 320,
    maxWidth: '100%',
    overflow: 'hidden',
    marginBottom: 16,
    background: '#000',
  },
  img: {
    width: '100%',
    height: 'auto',
    display: 'block',
    verticalAlign: 'top',
  },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '10px 18px',
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
  },
  okBtn: {
    padding: '10px 18px',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 600,
  },
};
