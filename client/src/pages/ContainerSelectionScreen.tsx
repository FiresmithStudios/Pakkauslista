import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOperator } from '../OperatorContext';
import { containersApi, exportDataAsync, subscribeToContainers } from '../api';
import type { Container } from '../types';
import ConfirmModal from '../components/ConfirmModal';

export default function ContainerSelectionScreen() {
  const { operatorName } = useOperator();
  const navigate = useNavigate();
  const [containers, setContainers] = useState<Container[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<Container | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteModal, setDeleteModal] = useState<Container | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!operatorName) {
      navigate('/', { replace: true });
    }
  }, [operatorName, navigate]);

  useEffect(() => {
    const unsub = subscribeToContainers(true, (data) => {
      setContainers(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (editModal) setEditValue(editModal.containerNumber);
  }, [editModal]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    const id = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', close);
    };
  }, [menuOpen]);

  const handleSelectContainer = (c: Container) => {
    if (menuOpen === c.id) setMenuOpen(null);
    else navigate(`/containers/${c.id}`);
  };

  const handleEditContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal || !editValue.trim()) return;
    setError(null);
    try {
      await containersApi.update(editModal.id, editValue.trim());
      setEditModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  const handleCloseContainer = async (c: Container) => {
    setMenuOpen(null);
    setError(null);
    try {
      await containersApi.close(c.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  const handleDeleteContainer = async () => {
    if (!deleteModal) return;
    setError(null);
    try {
      await containersApi.delete(deleteModal.id);
      setDeleteModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  const handleCreateOrSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = newNumber.trim();
    if (!num) return;
    setError(null);
    try {
      const existing = await containersApi.getByNumber(num).catch(() => null);
      if (existing) {
        navigate(`/containers/${existing.id}`);
      } else {
        const created = await containersApi.create(num);
        navigate(`/containers/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  if (!operatorName) return null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Kontit</h1>
            <p style={styles.operator}>Operaattori: {operatorName}</p>
          </div>
          <div style={styles.headerButtons}>
            <button
              type="button"
              onClick={() => navigate('/ai-search')}
              style={styles.aiSearchBtn}
              title="AI-tuotehaku etiketin kuvalla"
            >
              AI-haku
            </button>
            <button
            type="button"
            onClick={async () => {
              const json = await exportDataAsync();
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `warehouse-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={styles.exportBtn}
            title="Lataa tietokanta JSON-tiedostona"
          >
            Lataa varmuuskopio
            </button>
          </div>
        </div>
      </header>

      <form onSubmit={handleCreateOrSelect} style={styles.form}>
        <input
          ref={inputRef}
          type="text"
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
          placeholder="Kontin numero (merikontti)"
          style={styles.input}
        />
        <button type="submit" style={styles.button} disabled={!newNumber.trim()}>
          Avaa / Luo
        </button>
      </form>

      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Avoimet kontit</h2>
        {loading ? (
          <p style={styles.muted}>Ladataan...</p>
        ) : containers.length === 0 ? (
          <p style={styles.muted}>Ei avoimia kontteja. Luo uusi yllä.</p>
        ) : (
          <div style={styles.list}>
            {containers.map((c) => (
              <div key={c.id} style={styles.cardWrapper}>
                <button
                  style={styles.card}
                  onClick={() => handleSelectContainer(c)}
                >
                  <span style={styles.cardNumber}>{c.containerNumber}</span>
                  <button
                    style={styles.menuBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === c.id ? null : c.id);
                    }}
                    aria-label="Valikko"
                  >
                    ⋮
                  </button>
                </button>
                {menuOpen === c.id && (
                  <div style={styles.menu}>
                    <button style={styles.menuItem} onClick={() => { setEditModal(c); setMenuOpen(null); }}>
                      Muokkaa
                    </button>
                    <button style={styles.menuItem} onClick={() => handleCloseContainer(c)}>
                      Sulje kontti
                    </button>
                    <button style={styles.menuItemDanger} onClick={() => { setDeleteModal(c); setMenuOpen(null); }}>
                      Poista
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {editModal && (
        <div style={styles.modalOverlay} onClick={() => setEditModal(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Muokkaa konttia</h3>
            <form onSubmit={handleEditContainer}>
              <label style={styles.label}>Kontin numero</label>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                style={styles.modalInput}
                placeholder="Esim. CONT-001"
                autoFocus
              />
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={() => setEditModal(null)}>
                  Peruuta
                </button>
                <button type="submit" style={styles.submitBtn} disabled={!editValue.trim()}>
                  Tallenna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal && (
        <ConfirmModal
          title="Poista kontti"
          message={`Haluatko varmasti poistaa kontin "${deleteModal.containerNumber}"? Kaikki positiot poistetaan.`}
          confirmLabel="Poista"
          onConfirm={handleDeleteContainer}
          onCancel={() => setDeleteModal(null)}
          danger
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerButtons: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  aiSearchBtn: {
    padding: '10px 16px',
    fontSize: '0.9rem',
    fontWeight: 500,
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  exportBtn: {
    padding: '10px 16px',
    fontSize: '0.9rem',
    fontWeight: 500,
    background: 'var(--color-surface)',
    color: 'var(--color-accent)',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  operator: {
    margin: '4px 0 0',
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem',
  },
  form: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    padding: '14px 16px',
    fontSize: '1.125rem',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  button: {
    padding: '14px 20px',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
  },
  error: {
    color: '#f87171',
    margin: '0 0 16px',
    fontSize: '0.9rem',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardWrapper: {
    position: 'relative',
  },
  card: {
    width: '100%',
    padding: '18px 20px',
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    textAlign: 'left',
    color: 'var(--color-text)',
    fontSize: '1.125rem',
    fontWeight: 500,
    minHeight: 56,
    display: 'flex',
    alignItems: 'center',
  },
  cardNumber: {
    flex: 1,
  },
  menuBtn: {
    padding: '8px 12px',
    background: 'none',
    color: 'var(--color-text-muted)',
    fontSize: '1.25rem',
    lineHeight: 1,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    zIndex: 10,
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '12px 20px',
    textAlign: 'left',
    background: 'none',
    color: 'var(--color-text)',
    fontSize: '1rem',
  },
  menuItemDanger: {
    display: 'block',
    width: '100%',
    padding: '12px 20px',
    textAlign: 'left',
    background: 'none',
    color: '#f87171',
    fontSize: '1rem',
  },
  modalOverlay: {
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
  modalTitle: {
    margin: '0 0 20px',
    fontSize: '1.25rem',
    fontWeight: 600,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
  },
  modalInput: {
    width: '100%',
    padding: '12px 14px',
    marginBottom: 16,
    fontSize: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  cancelBtn: {
    padding: '12px 20px',
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500,
  },
  submitBtn: {
    padding: '12px 20px',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 600,
  },
  muted: {
    color: 'var(--color-text-muted)',
    fontSize: '0.95rem',
  },
};
