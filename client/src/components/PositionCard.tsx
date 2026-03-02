import { Link } from 'react-router-dom';
import ProgressBar from './ProgressBar';
import type { Position } from '../types';

interface PositionCardProps {
  position: Position;
  containerId: string;
}

export default function PositionCard({ position, containerId }: PositionCardProps) {
  const pct = position.totalQuantity > 0
    ? (position.packedQuantity / position.totalQuantity) * 100
    : 0;

  let statusColor = 'var(--color-grey)'; // 0%
  if (pct > 0 && pct < 100) statusColor = 'var(--color-progress)'; // in progress
  if (pct >= 100) statusColor = 'var(--color-success)'; // complete

  return (
    <Link
      to={`/containers/${containerId}/positions/${position.id}`}
      style={{ ...styles.card, borderLeftColor: statusColor }}
    >
      <div style={styles.header}>
        <span style={styles.positionNum}>#{position.positionNumber}</span>
        <span style={styles.name}>{position.name}</span>
      </div>
      <div style={styles.progress}>
        <ProgressBar value={pct} />
        <span style={styles.count}>
          {position.packedQuantity} / {position.totalQuantity}
        </span>
      </div>
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'block',
    padding: 16,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: '4px solid',
    textDecoration: 'none',
    color: 'inherit',
    minHeight: 72,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  positionNum: {
    fontWeight: 700,
    fontSize: '1.125rem',
    color: 'var(--color-accent)',
  },
  name: {
    fontSize: '1rem',
    fontWeight: 500,
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  count: {
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
    whiteSpace: 'nowrap',
  },
};
