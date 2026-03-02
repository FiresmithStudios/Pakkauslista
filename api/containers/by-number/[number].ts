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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const number = req.query.number as string;
  if (!number) return res.status(400).json({ error: 'number is required' });

  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    const result = await db.execute({ sql: 'SELECT * FROM containers WHERE containerNumber = ?', args: [number] });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ error: 'Container not found' });
    return res.status(200).json(normalizeContainer(row));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
