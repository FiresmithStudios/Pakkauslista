import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { loginByPin } from '../services/authService';

export default function PinLoginScreen() {
  const { user, setUser, loading } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !loading) {
      navigate('/containers', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pin.replace(/\D/g, '').slice(0, 4);
    if (trimmed.length !== 4) {
      setError('Syötä 4-numeroinen PIN-koodi');
      return;
    }
    setError(null);
    try {
      const loggedInUser = await loginByPin(trimmed);
      if (loggedInUser) {
        setUser(loggedInUser);
        navigate('/containers', { replace: true });
      } else {
        setError('Väärä PIN-koodi');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirjautuminen epäonnistui');
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(v);
    setError(null);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.muted}>Ladataan...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Warehouse Packing Tracker</h1>
        <p style={styles.subtitle}>Syötä PIN-koodisi kirjautuaksesi</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={handlePinChange}
            placeholder="••••"
            style={styles.input}
            autoComplete="one-time-code"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button} disabled={pin.length !== 4}>
            Kirjaudu
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
    fontSize: '1.5rem',
    letterSpacing: '0.5em',
    textAlign: 'center',
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
  error: {
    color: '#f87171',
    margin: 0,
    fontSize: '0.9rem',
  },
  muted: {
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
  },
};
