import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOperator } from '../OperatorContext';

export default function NameScreen() {
  const { operatorName, setOperatorName } = useOperator();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (operatorName) {
      navigate('/containers', { replace: true });
    }
  }, [operatorName, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      setOperatorName(trimmed);
      navigate('/containers', { replace: true });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Warehouse Packing Tracker</h1>
        <p style={styles.subtitle}>Syötä nimesi aloittaaksesi</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Operaattorin nimi"
            style={styles.input}
            autoComplete="name"
          />
          <button type="submit" style={styles.button} disabled={!name.trim()}>
            Jatka
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius)',
    padding: 32,
    width: '100%',
    maxWidth: 400,
    boxShadow: 'var(--shadow)',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  subtitle: {
    margin: '8px 0 24px',
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  input: {
    padding: '14px 16px',
    fontSize: '1.125rem',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  button: {
    padding: '16px 24px',
    fontSize: '1.125rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    opacity: 1,
  },
};
