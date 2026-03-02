const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

// GET /api/positions?containerId=xxx - list positions for container
router.get('/', (req, res) => {
  try {
    const { containerId } = req.query;
    if (!containerId) return res.status(400).json({ error: 'containerId is required' });
    const positions = db.prepare(
      'SELECT * FROM positions WHERE containerId = ? ORDER BY positionNumber ASC'
    ).all(containerId);
    res.json(positions.map(normalizePosition));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/positions - create position (body: containerId, positionNumber, name, totalQuantity, weight?, volume?, description?)
router.post('/', (req, res) => {
  try {
    const { containerId, positionNumber, name, totalQuantity, weight, volume, description } = req.body;
    if (!containerId || positionNumber == null || !name || totalQuantity == null) {
      return res.status(400).json({ error: 'containerId, positionNumber, name, totalQuantity are required' });
    }
    const num = Number(positionNumber);
    const total = Number(totalQuantity);
    if (isNaN(num) || num < 1 || isNaN(total) || total < 0) {
      return res.status(400).json({ error: 'Invalid positionNumber or totalQuantity' });
    }
    const id = uuidv4();
    db.prepare(`
      INSERT INTO positions (id, containerId, positionNumber, name, totalQuantity, weight, volume, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, containerId, num, String(name).trim(), total, weight ?? null, volume ?? null, description ?? null);
    const row = db.prepare('SELECT * FROM positions WHERE id = ?').get(id);
    res.status(201).json(normalizePosition(row));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Position number already exists in this container' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/positions/:id - update position
router.patch('/:id', (req, res) => {
  try {
    const { name, totalQuantity, weight, volume, description } = req.body;
    const pos = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
    if (!pos) return res.status(404).json({ error: 'Position not found' });

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(String(name).trim()); }
    if (totalQuantity !== undefined) {
      const t = Number(totalQuantity);
      if (isNaN(t) || t < 0) return res.status(400).json({ error: 'Invalid totalQuantity' });
      if (t < pos.packedQuantity) return res.status(400).json({ error: 'totalQuantity cannot be less than packedQuantity' });
      updates.push('totalQuantity = ?'); params.push(t);
    }
    if (weight !== undefined) { updates.push('weight = ?'); params.push(weight); }
    if (volume !== undefined) { updates.push('volume = ?'); params.push(volume); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }

    if (updates.length === 0) {
      const row = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
      return res.json(normalizePosition(row));
    }

    updates.push("updatedAt = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE positions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const row = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
    res.json(normalizePosition(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/positions/:id
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM positions WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Position not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/positions/:id/adjust - adjust packed quantity
router.post('/:id/adjust', (req, res) => {
  try {
    const { delta, operatorName } = req.body;
    const positionId = req.params.id;
    if (delta == null || !operatorName) {
      return res.status(400).json({ error: 'delta, operatorName are required' });
    }
    const d = Number(delta);
    if (isNaN(d) || d === 0) {
      return res.status(400).json({ error: 'delta must be a non-zero number' });
    }

    const pos = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    if (!pos) return res.status(404).json({ error: 'Position not found' });

    const newPacked = pos.packedQuantity + d;
    if (newPacked < 0) return res.status(400).json({ error: 'Packed quantity cannot go below 0' });
    if (newPacked > pos.totalQuantity) return res.status(400).json({ error: 'Packed quantity cannot exceed total quantity' });

    const transactionId = uuidv4();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO position_transactions (id, positionId, delta, operatorName, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(transactionId, positionId, d, String(operatorName).trim(), now);

      db.prepare(`
        UPDATE positions SET packedQuantity = ?, updatedAt = ? WHERE id = ?
      `).run(newPacked, now, positionId);
    })();

    const updatedPos = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    const lastTx = db.prepare(
      'SELECT * FROM position_transactions WHERE positionId = ? ORDER BY createdAt DESC LIMIT 1'
    ).get(positionId);

    res.json({
      position: normalizePosition(updatedPos),
      lastTransaction: lastTx ? {
        id: lastTx.id,
        delta: lastTx.delta,
        operatorName: lastTx.operatorName,
        createdAt: lastTx.createdAt,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/positions/:id/transactions
router.get('/:id/transactions', (req, res) => {
  try {
    const positionId = req.params.id;
    const pos = db.prepare('SELECT id FROM positions WHERE id = ?').get(positionId);
    if (!pos) return res.status(404).json({ error: 'Position not found' });
    const transactions = db.prepare(
      'SELECT * FROM position_transactions WHERE positionId = ? ORDER BY createdAt DESC'
    ).all(positionId);
    res.json(transactions.map(t => ({
      id: t.id,
      positionId: t.positionId,
      delta: t.delta,
      operatorName: t.operatorName,
      createdAt: t.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function normalizePosition(row) {
  return {
    id: row.id,
    containerId: row.containerId,
    positionNumber: row.positionNumber,
    name: row.name,
    totalQuantity: row.totalQuantity,
    packedQuantity: row.packedQuantity,
    weight: row.weight,
    volume: row.volume,
    description: row.description,
    updatedAt: row.updatedAt,
  };
}

module.exports = router;
