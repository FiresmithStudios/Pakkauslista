import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOperator } from '../OperatorContext';
import { containersApi, positionsApi, subscribeToContainers, subscribeToPositions } from '../api';
import type { Container, Position } from '../types';
import PositionCard from '../components/PositionCard';
import ProgressBar from '../components/ProgressBar';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';

export default function ContainerDetailScreen() {
  const { containerId } = useParams<{ containerId: string }>();
  const navigate = useNavigate();
  const { operatorName } = useOperator();
  const [container, setContainer] = useState<Container | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ positionNumber: '', name: '', totalQuantity: '' });
  const [containerMenuOpen, setContainerMenuOpen] = useState(false);
  const [editContainerModal, setEditContainerModal] = useState(false);
  const [editContainerValue, setEditContainerValue] = useState('');
  const [deleteContainerModal, setDeleteContainerModal] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!operatorName) {
      navigate('/', { replace: true });
      return;
    }
  }, [operatorName, navigate]);

  useEffect(() => {
    if (!containerId) return;
    const unsubContainer = subscribeToContainers(false, (list) => {
      const c = list.find((x) => x.id === containerId || x.containerNumber === containerId);
      setContainer(c ?? null);
      setLoading(false);
    });
    const unsubPositions = subscribeToPositions(containerId, (list) => {
      setPositions(list);
    });
    return () => {
      unsubContainer();
      unsubPositions();
    };
  }, [containerId]);

  useEffect(() => {
    if (showAddModal) nameInputRef.current?.focus();
  }, [showAddModal]);

  useEffect(() => {
    if (editContainerModal && container) setEditContainerValue(container.containerNumber);
  }, [editContainerModal, container]);

  const handleEditContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!containerId || !editContainerValue.trim()) return;
    setError(null);
    try {
      const updated = await containersApi.update(containerId, editContainerValue.trim());
      setContainer(updated);
      setEditContainerModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  const handleCloseContainer = async () => {
    if (!containerId) return;
    setError(null);
    try {
      await containersApi.close(containerId);
      setContainer((c) => c ? { ...c, isClosed: true } : null);
      setContainerMenuOpen(false);
      navigate('/containers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  const handleDeleteContainer = async () => {
    if (!containerId) return;
    setError(null);
    try {
      await containersApi.delete(containerId);
      setDeleteContainerModal(false);
      navigate('/containers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(addForm.positionNumber, 10);
    const total = parseInt(addForm.totalQuantity, 10);
    if (!containerId || isNaN(num) || num < 1 || !addForm.name.trim() || isNaN(total) || total < 0) return;
    setError(null);
    try {
      await positionsApi.create({
        containerId,
        positionNumber: num,
        name: addForm.name.trim(),
        totalQuantity: total,
      });
      setAddForm({ positionNumber: '', name: '', totalQuantity: '' });
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  if (!operatorName || !containerId) return null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate('/containers')}>
          ← Takaisin
        </button>
        <div style={styles.titleRow}>
          <h1 style={styles.title}>{container?.containerNumber ?? '...'}</h1>
          {container && !container.isClosed && (
            <div style={styles.headerMenuWrap}>
              <button
                style={styles.menuBtn}
                onClick={() => setContainerMenuOpen(!containerMenuOpen)}
                aria-label="Valikko"
              >
                ⋮
              </button>
              {containerMenuOpen && (
                <div style={styles.headerMenu}>
                  <button style={styles.menuItem} onClick={() => { setEditContainerModal(true); setContainerMenuOpen(false); }}>
                    Muokkaa konttia
                  </button>
                  <button style={styles.menuItem} onClick={handleCloseContainer}>
                    Sulje kontti
                  </button>
                  <button style={styles.menuItemDanger} onClick={() => { setDeleteContainerModal(true); setContainerMenuOpen(false); }}>
                    Poista kontti
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {error && <p style={styles.error}>{error}</p>}

      {positions.length > 0 && !loading && (
        <div style={styles.containerProgress}>
          {(() => {
            const totalPacked = positions.reduce((s, p) => s + p.packedQuantity, 0);
            const totalItems = positions.reduce((s, p) => s + p.totalQuantity, 0);
            const pct = totalItems > 0 ? (totalPacked / totalItems) * 100 : 0;
            const left = totalItems - totalPacked;
            return (
              <>
                <div style={styles.containerProgressHeader}>
                  <span style={styles.containerProgressLabel}>Kontin valmius</span>
                  <span style={styles.containerProgressCount}>
                    {totalPacked} / {totalItems} kpl ({Math.round(pct)}%)
                  </span>
                </div>
                <ProgressBar value={pct} />
                {left > 0 && (
                  <p style={styles.itemsLeft}>Jäljellä: {left} kpl</p>
                )}
              </>
            );
          })()}
        </div>
      )}

      {loading ? (
        <p style={styles.muted}>Ladataan...</p>
      ) : positions.length === 0 ? (
        <EmptyState message="Ei positioita. Lisää ensimmäinen." />
      ) : (
        <div style={styles.list}>
          {positions.map((p) => (
            <PositionCard key={p.id} position={p} containerId={containerId} />
          ))}
        </div>
      )}

      <button style={styles.fab} onClick={() => setShowAddModal(true)}>
        + Lisää positio
      </button>

      {showAddModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Lisää positio</h3>
            <form onSubmit={handleAddPosition}>
              <label style={styles.label}>Positio #</label>
              <input
                type="number"
                min={1}
                value={addForm.positionNumber}
                onChange={(e) => setAddForm((f) => ({ ...f, positionNumber: e.target.value }))}
                style={styles.input}
                placeholder="1"
              />
              <label style={styles.label}>Nimi</label>
              <input
                ref={nameInputRef}
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                style={styles.input}
                placeholder="Esim. Laatikko A1"
              />
              <label style={styles.label}>Kokonaismäärä</label>
              <input
                type="number"
                min={0}
                value={addForm.totalQuantity}
                onChange={(e) => setAddForm((f) => ({ ...f, totalQuantity: e.target.value }))}
                style={styles.input}
                placeholder="100"
              />
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowAddModal(false)}>
                  Peruuta
                </button>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={
                    !addForm.positionNumber ||
                    !addForm.name.trim() ||
                    !addForm.totalQuantity ||
                    parseInt(addForm.totalQuantity, 10) < 0
                  }
                >
                  Lisää
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editContainerModal && (
        <div style={styles.modalOverlay} onClick={() => setEditContainerModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Muokkaa konttia</h3>
            <form onSubmit={handleEditContainer}>
              <label style={styles.label}>Kontin numero</label>
              <input
                type="text"
                value={editContainerValue}
                onChange={(e) => setEditContainerValue(e.target.value)}
                style={styles.input}
                placeholder="Esim. CONT-001"
              />
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={() => setEditContainerModal(false)}>
                  Peruuta
                </button>
                <button type="submit" style={styles.submitBtn} disabled={!editContainerValue.trim()}>
                  Tallenna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteContainerModal && (
        <ConfirmModal
          title="Poista kontti"
          message={`Haluatko varmasti poistaa kontin "${container?.containerNumber}"? Kaikki positiot poistetaan.`}
          confirmLabel="Poista"
          onConfirm={handleDeleteContainer}
          onCancel={() => setDeleteContainerModal(false)}
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
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerMenuWrap: {
    position: 'relative',
  },
  menuBtn: {
    padding: '8px 12px',
    background: 'none',
    color: 'var(--color-text-muted)',
    fontSize: '1.25rem',
    lineHeight: 1,
  },
  headerMenu: {
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
  error: {
    color: '#f87171',
    margin: '0 0 16px',
    fontSize: '0.9rem',
  },
  containerProgress: {
    marginBottom: 24,
    padding: 16,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
  },
  containerProgressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  containerProgressLabel: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  },
  containerProgressCount: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  itemsLeft: {
    margin: '8px 0 0',
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
  },
  muted: {
    color: 'var(--color-text-muted)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  fab: {
    position: 'fixed',
    bottom: 24,
    left: 24,
    right: 24,
    padding: '18px 24px',
    fontSize: '1.125rem',
    fontWeight: 600,
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow)',
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
  input: {
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
};
