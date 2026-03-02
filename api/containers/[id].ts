import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../../lib/db';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    if (req.method === 'GET') {
      let result = await db.execute({ sql: 'SELECT * FROM containers WHERE id = ?', args: [id] });
      let row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        result = await db.execute({ sql: 'SELECT * FROM containers WHERE containerNumber = ?', args: [id] });
        row = result.rows[0] as Record<string, unknown> | undefined;
      }
      if (!row) return res.status(404).json({ error: 'Container not found' });
      return res.status(200).json(normalizeContainer(row));
    }

    if (req.method === 'PATCH') {
      const { containerNumber } = req.body as { containerNumber?: string };
      if (!containerNumber || !String(containerNumber).trim()) {
        return res.status(400).json({ error: 'containerNumber is required' });
      }
      let result = await db.execute({ sql: 'SELECT id FROM containers WHERE id = ?', args: [id] });
      let container = result.rows[0] as Record<string, unknown> | undefined;
      if (!container) {
        result = await db.execute({ sql: 'SELECT id FROM containers WHERE containerNumber = ?', args: [id] });
        container = result.rows[0] as Record<string, unknown> | undefined;
      }
      if (!container) return res.status(404).json({ error: 'Container not found' });
      const containerId = container.id as string;
      await db.execute({
        sql: 'UPDATE containers SET containerNumber = ? WHERE id = ?',
        args: [String(containerNumber).trim(), containerId],
      });
      result = await db.execute({ sql: 'SELECT * FROM containers WHERE id = ?', args: [containerId] });
      const row = result.rows[0] as Record<string, unknown>;
      return res.status(200).json(normalizeContainer(row));
    }

    if (req.method === 'DELETE') {
      let result = await db.execute({ sql: 'SELECT id FROM containers WHERE id = ?', args: [id] });
      let container = result.rows[0] as Record<string, unknown> | undefined;
      if (!container) {
        result = await db.execute({ sql: 'SELECT id FROM containers WHERE containerNumber = ?', args: [id] });
        container = result.rows[0] as Record<string, unknown> | undefined;
      }
      if (!container) return res.status(404).json({ error: 'Container not found' });
      const containerId = container.id as string;

      const positionsResult = await db.execute({ sql: 'SELECT id FROM positions WHERE containerId = ?', args: [containerId] });
      for (const p of positionsResult.rows) {
        const pos = p as Record<string, unknown>;
        await db.execute({ sql: 'DELETE FROM position_transactions WHERE positionId = ?', args: [pos.id] });
      }
      await db.execute({ sql: 'DELETE FROM positions WHERE containerId = ?', args: [containerId] });
      await db.execute({ sql: 'DELETE FROM containers WHERE id = ?', args: [containerId] });
      return res.status(204).end();
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
