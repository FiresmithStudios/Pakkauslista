import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

function normalizeContainer(row: Record<string, unknown>) {
  return {
    id: row.id,
    containerNumber: row.containerNumber,
    createdAt: row.createdAt,
    isClosed: Boolean(row.isClosed),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    if (req.method === 'GET') {
      const openOnly = req.query.open === 'true';
      let sql = 'SELECT * FROM containers';
      if (openOnly) sql += ' WHERE isClosed = 0';
      sql += ' ORDER BY createdAt DESC';
      const result = await db.execute({ sql });
      const containers = result.rows.map((r) => normalizeContainer(r as Record<string, unknown>));
      return res.status(200).json(containers);
    }

    if (req.method === 'POST') {
      const { containerNumber } = req.body as { containerNumber?: string };
      if (!containerNumber || !String(containerNumber).trim()) {
        return res.status(400).json({ error: 'containerNumber is required' });
      }
      const id = uuidv4();
      await db.execute({
        sql: 'INSERT INTO containers (id, containerNumber) VALUES (?, ?)',
        args: [id, String(containerNumber).trim()],
      });
      const result = await db.execute({ sql: 'SELECT * FROM containers WHERE id = ?', args: [id] });
      const row = result.rows[0] as Record<string, unknown>;
      return res.status(201).json(normalizeContainer(row));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = (err as { code?: string })?.code;
    if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Container number already exists' });
    }
    return res.status(500).json({ error: message });
  }
}
