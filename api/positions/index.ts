import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

function normalizePosition(row: Record<string, unknown>) {
  return {
    id: row.id,
    containerId: row.containerId,
    positionNumber: row.positionNumber,
    name: row.name,
    totalQuantity: row.totalQuantity,
    packedQuantity: row.packedQuantity,
    weight: row.weight,
    volume: row.volume,
    description: row.description,
    updatedAt: row.updatedAt,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const { db, initDb } = await getDb();
  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    if (req.method === 'GET') {
      const containerId = req.query.containerId as string;
      if (!containerId) return res.status(400).json({ error: 'containerId is required' });
      const result = await db.execute({
        sql: 'SELECT * FROM positions WHERE containerId = ? ORDER BY positionNumber ASC',
        args: [containerId],
      });
      const positions = result.rows.map((r) => normalizePosition(r as Record<string, unknown>));
      return res.status(200).json(positions);
    }

    if (req.method === 'POST') {
      const { containerId, positionNumber, name, totalQuantity, weight, volume, description } = req.body as Record<string, unknown>;
      if (!containerId || positionNumber == null || !name || totalQuantity == null) {
        return res.status(400).json({ error: 'containerId, positionNumber, name, totalQuantity are required' });
      }
      const num = Number(positionNumber);
      const total = Number(totalQuantity);
      if (isNaN(num) || num < 1 || isNaN(total) || total < 0) {
        return res.status(400).json({ error: 'Invalid positionNumber or totalQuantity' });
      }
      const id = uuidv4();
      await db.execute({
        sql: 'INSERT INTO positions (id, containerId, positionNumber, name, totalQuantity, weight, volume, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [id, containerId, num, String(name).trim(), total, weight ?? null, volume ?? null, description ?? null],
      });
      const result = await db.execute({ sql: 'SELECT * FROM positions WHERE id = ?', args: [id] });
      const row = result.rows[0] as Record<string, unknown>;
      return res.status(201).json(normalizePosition(row));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = (err as { code?: string })?.code;
    if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Position number already exists in this container' });
    }
    return res.status(500).json({ error: message });
  }
}
