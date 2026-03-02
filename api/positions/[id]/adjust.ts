import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../../../lib/db';
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id is required' });

  const { delta, operatorName } = req.body as { delta?: number; operatorName?: string };
  if (delta == null || !operatorName) {
    return res.status(400).json({ error: 'delta, operatorName are required' });
  }
  const d = Number(delta);
  if (isNaN(d) || d === 0) {
    return res.status(400).json({ error: 'delta must be a non-zero number' });
  }

  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    const posResult = await db.execute({ sql: 'SELECT * FROM positions WHERE id = ?', args: [id] });
    const pos = posResult.rows[0] as Record<string, unknown> | undefined;
    if (!pos) return res.status(404).json({ error: 'Position not found' });

    const packedQuantity = (pos.packedQuantity as number) || 0;
    const totalQuantity = pos.totalQuantity as number;
    const newPacked = packedQuantity + d;

    if (newPacked < 0) return res.status(400).json({ error: 'Packed quantity cannot go below 0' });
    if (newPacked > totalQuantity) return res.status(400).json({ error: 'Packed quantity cannot exceed total quantity' });

    const transactionId = uuidv4();
    const now = new Date().toISOString();

    await db.execute({
      sql: 'INSERT INTO position_transactions (id, positionId, delta, operatorName, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [transactionId, id, d, String(operatorName).trim(), now],
    });
    await db.execute({
      sql: 'UPDATE positions SET packedQuantity = ?, updatedAt = ? WHERE id = ?',
      args: [newPacked, now, id],
    });

    const updatedResult = await db.execute({ sql: 'SELECT * FROM positions WHERE id = ?', args: [id] });
    const updatedPos = updatedResult.rows[0] as Record<string, unknown>;
    const txResult = await db.execute({
      sql: 'SELECT * FROM position_transactions WHERE positionId = ? ORDER BY createdAt DESC LIMIT 1',
      args: [id],
    });
    const lastTx = txResult.rows[0] as Record<string, unknown> | undefined;

    return res.status(200).json({
      position: normalizePosition(updatedPos),
      lastTransaction: lastTx ? {
        id: lastTx.id,
        delta: lastTx.delta,
        operatorName: lastTx.operatorName,
        createdAt: lastTx.createdAt,
      } : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
