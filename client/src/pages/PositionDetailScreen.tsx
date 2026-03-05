import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOperator } from '../OperatorContext';
import { positionsApi, subscribeToPosition, subscribeToTransactions } from '../api';
import type { Position, PositionTransaction } from '../types';
import ProgressBar from '../components/ProgressBar';
import TransactionOverlay from '../components/TransactionOverlay';
import ConfirmModal from '../components/ConfirmModal';

export default function PositionDetailScreen() {
  const { containerId, positionId } = useParams<{ containerId: string; positionId: string }>();
  const navigate = useNavigate();
  const { operatorName } = useOperator();
  const [position, setPosition] = useState<Position | null>(null);
  const [lastTransaction, setLastTransaction] = useState<PositionTransaction | null>(null);
  const [transactions, setTransactions] = useState<PositionTransaction[]>([]);
  const [adjustValue, setAdjustValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', totalQuantity: '', notes: '' });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!operatorName) {
      navigate('/', { replace: true });
      return;
    }
  }, [operatorName, navigate]);

  useEffect(() => {
    if (!containerId || !positionId) return;
    const unsubPosition = subscribeToPosition(positionId, containerId, (pos) => {
      setPosition(pos);
      setLoading(false);
    });
    const unsubTx = subscribeToTransactions(positionId, (txs) => {
      setTransactions(txs);
      setLastTransaction(txs[0] ?? null);
    });
    return () => {
      unsubPosition();
      unsubTx();
    };
  }, [containerId, positionId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (position && showEditModal) {
      setEditForm({
        name: position.name,
        totalQuantity: String(position.totalQuantity),
        notes: position.notes ?? '',
      });
    }
  }, [position, showEditModal]);

  const handleAdjust = async (direction: number, amount?: number) => {
    if (!positionId || !operatorName || direction === 0) return;
    const num = amount ?? (parseInt(adjustValue, 10) || 1);
    const actualDelta = direction > 0 ? num : -num;
    setError(null);
    try {
      const res = await positionsApi.adjust(positionId, actualDelta, operatorName);
      setPosition(res.position);
      setLastTransaction(res.lastTransaction);
      setAdjustValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdjust(1, undefined);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!positionId || !position) return;
    const total = parseInt(editForm.totalQuantity, 10);
    if (isNaN(total) || total < 0 || !editForm.name.trim()) return;
    if (total < position.packedQuantity) return;
    setError(null);
    try {
      const updated = await positionsApi.update(positionId, {
        name: editForm.name.trim(),
        totalQuantity: total,
        notes: editForm.notes.trim() || undefined,
      });
      setPosition(updated);
      setShowEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  const handleDelete = async () => {
    if (!positionId || !containerId) return;
    setError(null);
    try {
      await positionsApi.delete(positionId);
      navigate(`/containers/${containerId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Virhe');
    }
  };

  if (!operatorName || !containerId || !positionId) return null;

  const pct = position && position.totalQuantity > 0
    ? (position.packedQuantity / position.totalQuantity) * 100
    : 0;

  const itemsLeft = position ? position.totalQuantity - position.packedQuantity : 0;

  const positiveDeltas = transactions.filter((t) => t.delta > 0).map((t) => t.delta);
  const lastPositiveDelta = lastTransaction && lastTransaction.delta > 0 ? lastTransaction.delta : null;
  const mostCommonDelta = (() => {
    if (positiveDeltas.length === 0) return null;
    const counts: Record<number, number> = {};
    for (const d of positiveDeltas) counts[d] = (counts[d] ?? 0) + 1;
    return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) ?? null;
  })();
  const palletEstimate = mostCommonDelta && itemsLeft > 0
    ? Math.ceil(itemsLeft / mostCommonDelta)
    : null;

  const canAdd = position && position.packedQuantity < position.totalQuantity;
  const canSubtract = position && position.packedQuantity > 0;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate(`/containers/${containerId}`)}>
          ← Takaisin
        </button>
      </header>

      {loading ? (
        <p style={styles.muted}>Ladataan...</p>
      ) : !position ? (
        <p style={styles.muted}>Positio ei löytynyt.</p>
      ) : (
        <>
          <div style={styles.main}>
            <div style={styles.positionHeader}>
              <span style={styles.positionNum}>#{position.positionNumber}</span>
              <h1 style={styles.name}>{position.name}</h1>
            </div>

            <div style={styles.progressSection}>
              <ProgressBar value={pct} />
              <div style={styles.countRow}>
                <span style={styles.count}>
                  {position.packedQuantity} / {position.totalQuantity}
                </span>
                <span style={styles.itemsLeft}>Jäljellä: {itemsLeft} kpl</span>
              </div>
              {palletEstimate != null && palletEstimate > 0 && (
                <p style={styles.palletEstimate}>
                  Arvio: ~{palletEstimate} pallettia jäljellä
                  {mostCommonDelta && ` (${mostCommonDelta} kpl/palletti)`}
                </p>
              )}
            </div>

            <div style={styles.adjustSection}>
              {lastPositiveDelta != null && canAdd && (
                <button
                  style={styles.quickAddBtn}
                  onClick={() => handleAdjust(1, lastPositiveDelta)}
                  title={`Lisää ${lastPositiveDelta} (edellinen määrä)`}
                >
                  +{lastPositiveDelta} (edellinen)
                </button>
              )}
              <input
                ref={inputRef}
                type="number"
                min={1}
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={handleKeyDown}
                placeholder="Määrä"
                style={styles.input}
              />
              <div style={styles.buttons}>
                <button
                  style={styles.minusBtn}
                  onClick={() => handleAdjust(-1, undefined)}
                  disabled={!canSubtract}
                >
                  −
                </button>
                <button
                  style={styles.plusBtn}
                  onClick={() => handleAdjust(1, undefined)}
                  disabled={!canAdd}
                >
                  +
                </button>
              </div>
            </div>

            {position.notes && (
              <div style={styles.extra}>
                <p style={styles.extraLabel}>Muistiinpanot</p>
                <p style={styles.extraRow}>{position.notes}</p>
              </div>
            )}

            <div style={styles.actionRow}>
              <button style={styles.editBtn} onClick={() => setShowEditModal(true)}>
                Muokkaa
              </button>
              <button style={styles.deleteBtn} onClick={() => setShowDeleteModal(true)}>
                Poista positio
              </button>
            </div>
          </div>

          <div style={styles.overlayWrapper}>
            <TransactionOverlay transaction={lastTransaction} />
          </div>
        </>
      )}

      {error && <p style={styles.error}>{error}</p>}

      {showEditModal && position && (
        <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Muokkaa positiota</h3>
            <form onSubmit={handleEdit}>
              <label style={styles.label}>Nimi</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                style={styles.modalInput}
                placeholder="Esim. Laatikko A1"
              />
              <label style={styles.label}>Kokonaismäärä</label>
              <input
                type="number"
                min={position.packedQuantity}
                value={editForm.totalQuantity}
                onChange={(e) => setEditForm((f) => ({ ...f, totalQuantity: e.target.value }))}
                style={styles.modalInput}
                placeholder="100"
              />
              <label style={styles.label}>Muistiinpanot (valinnainen)</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                style={styles.textarea}
                placeholder="Tilauksen numero, asiakas, tuotetiedot jne."
                rows={4}
              />
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowEditModal(false)}>
                  Peruuta
                </button>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={
                    !editForm.name.trim() ||
                    parseInt(editForm.totalQuantity, 10) < position.packedQuantity
                  }
                >
                  Tallenna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <ConfirmModal
          title="Poista positio"
          message={`Haluatko varmasti poistaa position "${position?.name}"?`}
          confirmLabel="Poista"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
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
    paddingBottom: 120,
    position: 'relative',
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    background: 'none',
    color: 'var(--color-accent)',
    fontWeight: 500,
    padding: 8,
    fontSize: '1rem',
  },
  muted: {
    color: 'var(--color-text-muted)',
  },
  main: {
    maxWidth: 480,
    margin: '0 auto',
  },
  positionHeader: {
    marginBottom: 24,
  },
  positionNum: {
    display: 'block',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-accent)',
    marginBottom: 4,
  },
  name: {
    margin: 0,
    fontSize: '1.75rem',
    fontWeight: 700,
  },
  progressSection: {
    marginBottom: 32,
  },
  countRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  count: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  },
  itemsLeft: {
    fontSize: '1rem',
    fontWeight: 500,
    color: 'var(--color-accent)',
  },
  palletEstimate: {
    margin: '8px 0 0',
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
  },
  quickAddBtn: {
    width: '100%',
    padding: '14px 20px',
    marginBottom: 12,
    fontSize: '1.1rem',
    fontWeight: 600,
    background: 'var(--color-surface)',
    color: 'var(--color-accent)',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-accent)',
  },
  adjustSection: {
    marginBottom: 32,
  },
  input: {
    width: '100%',
    padding: '20px 24px',
    fontSize: '1.5rem',
    marginBottom: 16,
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  buttons: {
    display: 'flex',
    gap: 16,
  },
  minusBtn: {
    flex: 1,
    padding: '24px',
    fontSize: '2rem',
    fontWeight: 700,
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
  },
  plusBtn: {
    flex: 1,
    padding: '24px',
    fontSize: '2rem',
    fontWeight: 700,
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
  },
  extra: {
    marginBottom: 24,
    padding: 16,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
  },
  extraLabel: {
    margin: '0 0 8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  },
  extraRow: {
    margin: 0,
    fontSize: '0.95rem',
    color: 'var(--color-text-muted)',
    whiteSpace: 'pre-wrap',
  },
  actionRow: {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  },
  editBtn: {
    padding: '12px 20px',
    background: 'var(--color-surface)',
    color: 'var(--color-accent)',
    fontSize: '0.9rem',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-surface-hover)',
  },
  deleteBtn: {
    padding: '12px 20px',
    background: 'transparent',
    color: '#f87171',
    fontSize: '0.9rem',
    borderRadius: 'var(--radius-sm)',
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
    maxHeight: '90vh',
    overflowY: 'auto',
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
  overlayWrapper: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
  error: {
    position: 'fixed',
    bottom: 80,
    left: 24,
    right: 24,
    padding: 12,
    background: 'rgba(239, 68, 68, 0.9)',
    color: 'white',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
  },
};
