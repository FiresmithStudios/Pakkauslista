import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../../../lib/db';

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
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    let result = await db.execute({ sql: 'SELECT id FROM containers WHERE id = ?', args: [id] });
    let container = result.rows[0] as Record<string, unknown> | undefined;
    if (!container) {
      result = await db.execute({ sql: 'SELECT id FROM containers WHERE containerNumber = ?', args: [id] });
      container = result.rows[0] as Record<string, unknown> | undefined;
    }
    if (!container) return res.status(404).json({ error: 'Container not found' });
    const containerId = container.id as string;

    await db.execute({ sql: 'UPDATE containers SET isClosed = 1 WHERE id = ?', args: [containerId] });
    result = await db.execute({ sql: 'SELECT * FROM containers WHERE id = ?', args: [containerId] });
    const row = result.rows[0] as Record<string, unknown>;
    return res.status(200).json(normalizeContainer(row));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
