import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { containersApi, positionsApi, subscribeToContainers, subscribeToPositions } from '../api';
import type { Container, Position } from '../types';
import PositionCard from '../components/PositionCard';
import ProgressBar from '../components/ProgressBar';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import AddPositionWithAiModal from '../components/AddPositionWithAiModal';
import { logEvent } from '../services/eventsService';
import { useTopBar } from '../contexts/TopBarContext';
import { IconPlus, IconSparkles, IconEdit, IconTrash } from '../components/Icons';

export default function ContainerDetailScreen() {
  const { containerId } = useParams<{ containerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [container, setContainer] = useState<Container | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiAddModal, setShowAiAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ positionNumber: '', name: '', totalQuantity: '', notes: '' });
  const [editContainerModal, setEditContainerModal] = useState(false);
  const [editContainerValue, setEditContainerValue] = useState('');
  const [deleteContainerModal, setDeleteContainerModal] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
  }, [user, navigate]);

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

  const { setTitle, setMenuItems, clearMenuItems } = useTopBar();
  useEffect(() => {
    setTitle(container?.containerNumber ?? '...');
  }, [setTitle, container?.containerNumber]);

  useEffect(() => {
    if (!container || container.isClosed) {
      clearMenuItems();
      return;
    }
    setMenuItems([
      {
        id: 'add-position-manual',
        label: 'Lisää positio',
        icon: <IconPlus />,
        onClick: () => setShowAddModal(true),
      },
      {
        id: 'add-position-ai',
        label: 'Lisää positio AI:lla',
        icon: <IconSparkles />,
        onClick: () => setShowAiAddModal(true),
      },
      {
        id: 'edit-container',
        label: 'Muokkaa konttia',
        icon: <IconEdit />,
        onClick: () => setEditContainerModal(true),
      },
      {
        id: 'close-container',
        label: 'Sulje kontti',
        onClick: handleCloseContainer,
      },
      {
        id: 'delete-container',
        label: 'Poista kontti',
        icon: <IconTrash />,
        danger: true,
        onClick: () => setDeleteContainerModal(true),
      },
    ]);
    return () => clearMenuItems();
  }, [container, setMenuItems, clearMenuItems]);

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
        notes: addForm.notes.trim() || undefined,
      });
      setAddForm({ positionNumber: '', name: '', totalQuantity: '', notes: '' });
      setShowAddModal(false);
      if (user) {
        await logEvent({
          userUuid: user.uuid,
          action: 'ADD_POSITION',
          containerId,
          metadata: { positionNumber: num, name: addForm.name.trim() },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  const handleCreatePositionFromAi = async (data: {
    positionNumber: number;
    name: string;
    totalQuantity: number;
    notes?: string;
  }) => {
    if (!containerId) return;
    await positionsApi.create({
      containerId,
      positionNumber: data.positionNumber,
      name: data.name,
      totalQuantity: data.totalQuantity,
      notes: data.notes,
    });
    if (user) {
      await logEvent({
        userUuid: user.uuid,
        action: 'ADD_POSITION',
        containerId,
        metadata: { positionNumber: data.positionNumber, name: data.name, source: 'ai' },
      });
    }
  };

  const nextPositionNumber =
    positions.length > 0
      ? Math.max(...positions.map((p) => p.positionNumber), 0) + 1
      : 1;

  if (!user || !containerId) return null;

  return (
    <div style={styles.container}>
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
              <label style={styles.label}>Muistiinpanot (valinnainen)</label>
              <textarea
                value={addForm.notes}
                onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                style={styles.textarea}
                placeholder="Tilauksen numero, asiakas, tuotetiedot jne. – AI käyttää näitä tunnistukseen"
                rows={4}
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

      {showAiAddModal && (
        <AddPositionWithAiModal
          nextPositionNumber={nextPositionNumber}
          onSuccess={() => {
            setShowAiAddModal(false);
          }}
          onCancel={() => setShowAiAddModal(false)}
          onCreatePosition={handleCreatePositionFromAi}
        />
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
    minHeight: '100%',
    paddingBottom: 100,
    position: 'relative',
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
  textarea: {
    width: '100%',
    padding: '12px 14px',
    marginBottom: 16,
    fontSize: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
    resize: 'vertical',
    minHeight: 80,
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
