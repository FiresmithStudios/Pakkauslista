const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb, db } = require('./db');
const containersRouter = require('./routes/containers');
const positionsRouter = require('./routes/positions');

initDb();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/containers', containersRouter);
app.use('/api/positions', positionsRouter);

// GET /api/export - download full database as JSON
app.get('/api/export', (req, res) => {
  try {
    const containers = db.prepare('SELECT * FROM containers ORDER BY createdAt DESC').all();
    const positions = db.prepare('SELECT * FROM positions ORDER BY containerId, positionNumber').all();
    const transactions = db.prepare('SELECT * FROM position_transactions ORDER BY createdAt DESC').all();

    const exportData = {
      exportedAt: new Date().toISOString(),
      containers: containers.map((c) => ({
        id: c.id,
        containerNumber: c.containerNumber,
        createdAt: c.createdAt,
        isClosed: Boolean(c.isClosed),
      })),
      positions: positions.map((p) => ({
        id: p.id,
        containerId: p.containerId,
        positionNumber: p.positionNumber,
        name: p.name,
        totalQuantity: p.totalQuantity,
        packedQuantity: p.packedQuantity,
        weight: p.weight,
        volume: p.volume,
        description: p.description,
        updatedAt: p.updatedAt,
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        positionId: t.positionId,
        delta: t.delta,
        operatorName: t.operatorName,
        createdAt: t.createdAt,
      })),
    };

    const filename = `warehouse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clear - clear entire database (all containers, positions, transactions)
app.delete('/api/clear', (req, res) => {
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM position_transactions').run();
      db.prepare('DELETE FROM positions').run();
      db.prepare('DELETE FROM containers').run();
    })();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend in production (when client/dist exists)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Warehouse Packing Tracker server running on http://localhost:${PORT}`);
});
