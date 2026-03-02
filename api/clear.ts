import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { db, initDb } = await getDb();
  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    await db.execute({ sql: 'DELETE FROM position_transactions' });
    await db.execute({ sql: 'DELETE FROM positions' });
    await db.execute({ sql: 'DELETE FROM containers' });
    return res.status(204).end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
