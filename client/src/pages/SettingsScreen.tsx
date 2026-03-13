import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getSettings, updateSettings } from '../services/settingsService';
import type { UserSettings } from '../types';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ displayName: string; appearance: 'light' | 'dark' | 'system' }>({
    displayName: '',
    appearance: 'dark',
  });

  useEffect(() => {
    if (!user) return;
    getSettings(user.uuid)
      .then((s) => {
        setSettings(s);
        setForm({
          displayName: s.displayName ?? user.name,
          appearance: (s.appearance as 'light' | 'dark' | 'system') ?? 'dark',
        });
      })
      .catch(() => setError('Asetusten lataus epäonnistui'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateSettings(user.uuid, {
        displayName: form.displayName.trim() || undefined,
        appearance: form.appearance,
      });
      setSettings(updated);
      const appearance = form.appearance;
      if (appearance === 'system') {
        delete document.documentElement.dataset.theme;
      } else {
        document.documentElement.dataset.theme = appearance;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate(-1)}>
          ← Takaisin
        </button>
        <h1 style={styles.title}>Asetukset</h1>
      </header>

      {loading ? (
        <p style={styles.muted}>Ladataan...</p>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Näyttönimi</label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            style={styles.input}
            placeholder={user.name}
          />

          <label style={styles.label}>Käyttöliittymän teema</label>
          <select
            value={form.appearance}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                appearance: e.target.value as 'light' | 'dark' | 'system',
              }))
            }
            style={styles.select}
          >
            <option value="dark">Tumma</option>
            <option value="light">Vaalea</option>
            <option value="system">Järjestelmän mukainen</option>
          </select>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.button} disabled={saving}>
            {saving ? 'Tallennetaan...' : 'Tallenna'}
          </button>

          <button
            type="button"
            style={styles.logoutBtn}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Kirjaudu ulos
          </button>
        </form>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: 24,
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    maxWidth: 400,
  },
  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  button: {
    padding: '16px 24px',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    marginTop: 8,
  },
  error: {
    color: '#f87171',
    margin: 0,
    fontSize: '0.9rem',
  },
  logoutBtn: {
    marginTop: 24,
    padding: '12px 20px',
    background: 'transparent',
    color: '#f87171',
    fontSize: '0.95rem',
    border: '2px solid #f87171',
    borderRadius: 'var(--radius-sm)',
  },
  muted: {
    color: 'var(--color-text-muted)',
  },
};
