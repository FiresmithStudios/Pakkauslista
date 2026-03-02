// Turso (libsql) when env is set; better-sqlite3 fallback otherwise (avoids ESM issues on Vercel)
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

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

export type DbClient = {
  execute: (opts: { sql: string; args?: unknown[] } | string) => Promise<{ rows: unknown[] }>;
};

let cached: Promise<{ db: DbClient; initDb: () => Promise<void> }> | null = null;

export async function getDb(): Promise<{ db: DbClient; initDb: () => Promise<void> }> {
  if (!cached) {
    cached = (async () => {
      if (url) {
        const { createClient } = await import('@libsql/client/web');
        const client = createClient({ url, authToken: authToken || undefined });
        const db: DbClient = {
          execute: (opts) => {
            const o = typeof opts === 'string' ? { sql: opts } : opts;
            return client.execute(o) as Promise<{ rows: unknown[] }>;
          },
        };
        const initDb = async () => {
          for (const s of INIT_STATEMENTS) await db.execute(s);
        };
        return { db, initDb };
      } else {
        const Database = require('better-sqlite3');
        const sqlite = new Database('/tmp/warehouse.db');
        const db: DbClient = {
          execute: (opts) => {
            const o = typeof opts === 'string' ? { sql: opts } : opts;
            const { sql, args = [] } = o;
            const stmt = sqlite.prepare(sql);
            const upper = sql.trim().toUpperCase();
            if (upper.startsWith('SELECT')) {
              return Promise.resolve({ rows: stmt.all(...(args as [])) });
            }
            stmt.run(...(args as []));
            return Promise.resolve({ rows: [] });
          },
        };
        const initDb = async () => {
          for (const s of INIT_STATEMENTS) sqlite.exec(s);
        };
        return { db, initDb };
      }
    })();
  }
  return cached;
}
