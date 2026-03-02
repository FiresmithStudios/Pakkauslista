const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'warehouse.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS containers (
      id TEXT PRIMARY KEY,
      containerNumber TEXT UNIQUE NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      isClosed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      containerId TEXT NOT NULL,
      positionNumber INTEGER NOT NULL,
      name TEXT NOT NULL,
      totalQuantity INTEGER NOT NULL,
      packedQuantity INTEGER DEFAULT 0,
      weight REAL,
      volume REAL,
      description TEXT,
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (containerId) REFERENCES containers(id),
      UNIQUE(containerId, positionNumber)
    );

    CREATE TABLE IF NOT EXISTS position_transactions (
      id TEXT PRIMARY KEY,
      positionId TEXT NOT NULL,
      delta INTEGER NOT NULL,
      operatorName TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (positionId) REFERENCES positions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_positions_container ON positions(containerId);
    CREATE INDEX IF NOT EXISTS idx_transactions_position ON position_transactions(positionId);
  `);
}

initDb();

module.exports = { db, initDb };
