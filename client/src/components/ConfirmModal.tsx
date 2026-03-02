interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Vahvista',
  cancelLabel = 'Peruuta',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmModalProps) {
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button style={styles.cancelButton} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            style={{
              ...styles.confirmButton,
              ...(danger ? styles.dangerButton : {}),
            }}
            onClick={onConfirm}
          >
            {confirmLabel}
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
    maxWidth: 400,
    width: '100%',
    boxShadow: 'var(--shadow)',
  },
  title: {
    margin: '0 0 12px',
    fontSize: '1.25rem',
    fontWeight: 600,
  },
  message: {
    margin: '0 0 24px',
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '12px 20px',
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500,
  },
  confirmButton: {
    padding: '12px 20px',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 600,
  },
  dangerButton: {
    background: '#ef4444',
    color: 'white',
  },
};
