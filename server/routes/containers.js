const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

// GET /api/containers - list all containers
router.get('/', (req, res) => {
  try {
    const openOnly = req.query.open === 'true';
    let sql = 'SELECT * FROM containers';
    const params = [];
    if (openOnly) {
      sql += ' WHERE isClosed = 0';
    }
    sql += ' ORDER BY createdAt DESC';
    const containers = db.prepare(sql).all(...params);
    res.json(containers.map(normalizeContainer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/containers/by-number/:number - get container by number (must be before /:id)
router.get('/by-number/:number', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM containers WHERE containerNumber = ?').get(req.params.number);
    if (!row) return res.status(404).json({ error: 'Container not found' });
    res.json(normalizeContainer(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/containers/:id - get single container
router.get('/:id', (req, res) => {
  try {
    let row = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!row) {
      row = db.prepare('SELECT * FROM containers WHERE containerNumber = ?').get(req.params.id);
    }
    if (!row) return res.status(404).json({ error: 'Container not found' });
    res.json(normalizeContainer(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/containers - create container
router.post('/', (req, res) => {
  try {
    const { containerNumber } = req.body;
    if (!containerNumber || !String(containerNumber).trim()) {
      return res.status(400).json({ error: 'containerNumber is required' });
    }
    const id = uuidv4();
    db.prepare(
      'INSERT INTO containers (id, containerNumber) VALUES (?, ?)'
    ).run(id, String(containerNumber).trim());
    const row = db.prepare('SELECT * FROM containers WHERE id = ?').get(id);
    res.status(201).json(normalizeContainer(row));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Container number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/containers/:id/close - close container (must be before /:id)
router.patch('/:id/close', (req, res) => {
  try {
    const idOrNumber = req.params.id;
    let container = db.prepare('SELECT id FROM containers WHERE id = ?').get(idOrNumber);
    if (!container) {
      container = db.prepare('SELECT id FROM containers WHERE containerNumber = ?').get(idOrNumber);
    }
    if (!container) return res.status(404).json({ error: 'Container not found' });
    const result = db.prepare('UPDATE containers SET isClosed = 1 WHERE id = ?').run(container.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Container not found' });
    const row = db.prepare('SELECT * FROM containers WHERE id = ?').get(container.id);
    res.json(normalizeContainer(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/containers/:id - update container
router.patch('/:id', (req, res) => {
  try {
    const { containerNumber } = req.body;
    if (!containerNumber || !String(containerNumber).trim()) {
      return res.status(400).json({ error: 'containerNumber is required' });
    }
    const idOrNumber = req.params.id;
    let container = db.prepare('SELECT id FROM containers WHERE id = ?').get(idOrNumber);
    if (!container) {
      container = db.prepare('SELECT id FROM containers WHERE containerNumber = ?').get(idOrNumber);
    }
    if (!container) return res.status(404).json({ error: 'Container not found' });
    const result = db.prepare(
      'UPDATE containers SET containerNumber = ? WHERE id = ?'
    ).run(String(containerNumber).trim(), container.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Container not found' });
    const row = db.prepare('SELECT * FROM containers WHERE id = ?').get(container.id);
    res.json(normalizeContainer(row));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Container number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/containers/:id - delete container and its positions
router.delete('/:id', (req, res) => {
  try {
    const idOrNumber = req.params.id;
    let container = db.prepare('SELECT id FROM containers WHERE id = ?').get(idOrNumber);
    if (!container) {
      container = db.prepare('SELECT id FROM containers WHERE containerNumber = ?').get(idOrNumber);
    }
    if (!container) return res.status(404).json({ error: 'Container not found' });

    const containerId = container.id;

    db.transaction(() => {
      const positions = db.prepare('SELECT id FROM positions WHERE containerId = ?').all(containerId);
      for (const p of positions) {
        db.prepare('DELETE FROM position_transactions WHERE positionId = ?').run(p.id);
      }
      db.prepare('DELETE FROM positions WHERE containerId = ?').run(containerId);
      db.prepare('DELETE FROM containers WHERE id = ?').run(containerId);
    })();

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function normalizeContainer(row) {
  return {
    id: row.id,
    containerNumber: row.containerNumber,
    createdAt: row.createdAt,
    isClosed: Boolean(row.isClosed),
  };
}

module.exports = router;
