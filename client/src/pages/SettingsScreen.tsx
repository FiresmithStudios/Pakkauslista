import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getSettings, updateSettings } from '../services/settingsService';
import { getAllUsedPins, generateRandomUnusedPin, updateUserPin } from '../services/usersService';
import ConfirmModal from '../components/ConfirmModal';
import { IconBack, IconSettings, IconKey } from '../components/Icons';
import type { UserSettings } from '../types';

const HOLD_DURATION_MS = 600;

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ displayName: string; appearance: 'light' | 'dark' | 'system' }>({
    displayName: '',
    appearance: 'dark',
  });
  const [showPin, setShowPin] = useState(false);
  const [newPinModal, setNewPinModal] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        document.documentElement.dataset.theme = 'system';
      } else if (appearance === 'light' || appearance === 'dark') {
        document.documentElement.dataset.theme = appearance;
      } else {
        document.documentElement.dataset.theme = 'dark';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui');
    } finally {
      setSaving(false);
    }
  };

  const handleGetNewPin = async () => {
    if (!user) return;
    setNewPinModal(true);
  };

  const confirmGetNewPin = async () => {
    if (!user) return;
    setError(null);
    try {
      const usedPins = await getAllUsedPins(user.uuid);
      const newPin = generateRandomUnusedPin(usedPins);
      await updateUserPin(user.uuid, newPin);
      await refreshUser();
      setGeneratedPin(newPin);
      setNewPinModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN-vaihto epäonnistui');
    }
  };

  const handleHoldStart = () => {
    holdTimerRef.current = setTimeout(() => {
      setShowPin(true);
      holdTimerRef.current = null;
    }, HOLD_DURATION_MS);
  };

  const handleHoldEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setShowPin(false);
  };

  if (!user) return null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate(-1)}>
          <IconBack />
          <span>Takaisin</span>
        </button>
        <div style={styles.titleRow}>
          <IconSettings />
          <h1 style={styles.title}>Asetukset</h1>
        </div>
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

          <label style={styles.label}>Teema</label>
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
            <option value="system">Järjestelmä</option>
          </select>

          <div style={styles.pinSection}>
            <label style={styles.label}>PIN-koodi</label>
            <button
              type="button"
              style={styles.checkPinBtn}
              onPointerDown={handleHoldStart}
              onPointerUp={handleHoldEnd}
              onPointerLeave={handleHoldEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
              <IconKey />
              <span>{showPin ? user.pin : 'Pidä painettuna nähdäksesi PIN'}</span>
            </button>
            <button
              type="button"
              style={styles.newPinBtn}
              onClick={handleGetNewPin}
            >
              Hae uusi PIN
            </button>
          </div>

          {generatedPin && (
            <p style={styles.generatedPin}>
              Uusi PIN: <strong>{generatedPin}</strong> — kirjaudu uudelleen muistaaksesi
            </p>
          )}

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

      {newPinModal && (
        <ConfirmModal
          title="Hae uusi PIN"
          message="Vanha PIN poistuu. Saat satunnaisen käyttämättömän 4-numeroisen PIN-koodin. Haluatko jatkaa?"
          confirmLabel="Hae uusi PIN"
          onConfirm={confirmGetNewPin}
          onCancel={() => setNewPinModal(false)}
        />
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
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    color: 'var(--color-accent)',
    fontWeight: 500,
    marginBottom: 8,
    padding: 8,
    fontSize: '1rem',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
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
  pinSection: {
    marginTop: 8,
  },
  checkPinBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '14px 16px',
    marginBottom: 8,
    background: 'var(--color-surface)',
    color: 'var(--color-text-muted)',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    fontSize: '0.95rem',
  },
  newPinBtn: {
    padding: '12px 20px',
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.95rem',
  },
  generatedPin: {
    padding: 12,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.95rem',
    color: 'var(--color-success)',
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
