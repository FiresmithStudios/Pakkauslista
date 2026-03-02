import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    const posResult = await db.execute({ sql: 'SELECT id FROM positions WHERE id = ?', args: [id] });
    if (posResult.rows.length === 0) return res.status(404).json({ error: 'Position not found' });

    const result = await db.execute({
      sql: 'SELECT * FROM position_transactions WHERE positionId = ? ORDER BY createdAt DESC',
      args: [id],
    });
    const transactions = result.rows.map((t) => {
      const row = t as Record<string, unknown>;
      return {
        id: row.id,
        positionId: row.positionId,
        delta: row.delta,
        operatorName: row.operatorName,
        createdAt: row.createdAt,
      };
    });
    return res.status(200).json(transactions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
