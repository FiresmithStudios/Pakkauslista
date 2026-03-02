import type { PositionTransaction } from '../types';

interface TransactionOverlayProps {
  transaction: PositionTransaction | null;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'juuri nyt';
  if (diffMin < 60) return `${diffMin} min sitten`;
  if (diffHr < 24) return `${diffHr} h sitten`;
  return date.toLocaleDateString('fi-FI');
}

export default function TransactionOverlay({ transaction }: TransactionOverlayProps) {
  if (!transaction) return null;

  const deltaStr = transaction.delta >= 0 ? `+${transaction.delta}` : String(transaction.delta);

  return (
    <div style={styles.overlay}>
      <span style={styles.operator}>{transaction.operatorName}</span>
      <span style={styles.delta}>{deltaStr}</span>
      <span style={styles.time}>{formatRelativeTime(transaction.createdAt)}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: '10px 14px',
    background: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  operator: {
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  delta: {
    color: 'var(--color-accent)',
    fontWeight: 600,
  },
  time: {
    marginLeft: 'auto',
  },
};
