// Use default client: supports file: on Node.js (Vercel) and remote URLs (Turso)
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:/tmp/warehouse.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({
  url,
  authToken: authToken || undefined,
});

const INIT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS containers (
    id TEXT PRIMARY KEY,
    containerNumber TEXT UNIQUE NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    isClosed INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS positions (
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
  )`,
  `CREATE TABLE IF NOT EXISTS position_transactions (
    id TEXT PRIMARY KEY,
    positionId TEXT NOT NULL,
    delta INTEGER NOT NULL,
    operatorName TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (positionId) REFERENCES positions(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_positions_container ON positions(containerId)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_position ON position_transactions(positionId)`,
];

export async function initDb() {
  for (const stmt of INIT_STATEMENTS) {
    await db.execute(stmt);
  }
}
