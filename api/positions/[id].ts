import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../lib/db';

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
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id is required' });

  const { db, initDb } = await getDb();
  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    if (req.method === 'PATCH') {
      const { name, totalQuantity, weight, volume, description } = req.body as Record<string, unknown>;
      const result = await db.execute({ sql: 'SELECT * FROM positions WHERE id = ?', args: [id] });
      const pos = result.rows[0] as Record<string, unknown> | undefined;
      if (!pos) return res.status(404).json({ error: 'Position not found' });

      const updates: string[] = [];
      const args: unknown[] = [];
      if (name !== undefined) { updates.push('name = ?'); args.push(String(name).trim()); }
      if (totalQuantity !== undefined) {
        const t = Number(totalQuantity);
        if (isNaN(t) || t < 0) return res.status(400).json({ error: 'Invalid totalQuantity' });
        if (t < (pos.packedQuantity as number)) return res.status(400).json({ error: 'totalQuantity cannot be less than packedQuantity' });
        updates.push('totalQuantity = ?'); args.push(t);
      }
      if (weight !== undefined) { updates.push('weight = ?'); args.push(weight); }
      if (volume !== undefined) { updates.push('volume = ?'); args.push(volume); }
      if (description !== undefined) { updates.push('description = ?'); args.push(description); }

      if (updates.length === 0) {
        return res.status(200).json(normalizePosition(pos));
      }

      updates.push("updatedAt = datetime('now')");
      args.push(id);
      await db.execute({
        sql: `UPDATE positions SET ${updates.join(', ')} WHERE id = ?`,
        args,
      });
      const result2 = await db.execute({ sql: 'SELECT * FROM positions WHERE id = ?', args: [id] });
      const row = result2.rows[0] as Record<string, unknown>;
      return res.status(200).json(normalizePosition(row));
    }

    if (req.method === 'DELETE') {
      const checkResult = await db.execute({ sql: 'SELECT id FROM positions WHERE id = ?', args: [id] });
      if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Position not found' });
      await db.execute({ sql: 'DELETE FROM position_transactions WHERE positionId = ?', args: [id] });
      await db.execute({ sql: 'DELETE FROM positions WHERE id = ?', args: [id] });
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
