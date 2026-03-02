interface ProgressBarProps {
  value: number; // 0-100
}

export default function ProgressBar({ value }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={styles.track}>
      <div style={{ ...styles.fill, width: `${pct}%` }} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  track: {
    flex: 1,
    height: 8,
    background: 'var(--color-surface-hover)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    background: 'var(--color-progress)',
    borderRadius: 4,
    transition: 'width 0.2s ease',
  },
};
