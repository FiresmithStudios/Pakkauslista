interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({ message = 'Ei kohteita' }: EmptyStateProps) {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>📦</div>
      <p style={styles.text}>{message}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 48,
    textAlign: 'center',
  },
  icon: {
    fontSize: '3rem',
    opacity: 0.5,
    marginBottom: 16,
  },
  text: {
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
    margin: 0,
  },
};
