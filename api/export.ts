import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { db, initDb } = await getDb();
  try {
    await initDb();
  } catch {
    // Tables may already exist
  }

  try {
    const [containersResult, positionsResult, transactionsResult] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM containers ORDER BY createdAt DESC' }),
      db.execute({ sql: 'SELECT * FROM positions ORDER BY containerId, positionNumber' }),
      db.execute({ sql: 'SELECT * FROM position_transactions ORDER BY createdAt DESC' }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      containers: containersResult.rows.map((c) => {
        const row = c as Record<string, unknown>;
        return {
          id: row.id,
          containerNumber: row.containerNumber,
          createdAt: row.createdAt,
          isClosed: Boolean(row.isClosed),
        };
      }),
      positions: positionsResult.rows.map((p) => {
        const row = p as Record<string, unknown>;
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
      }),
      transactions: transactionsResult.rows.map((t) => {
        const row = t as Record<string, unknown>;
        return {
          id: row.id,
          positionId: row.positionId,
          delta: row.delta,
          operatorName: row.operatorName,
          createdAt: row.createdAt,
        };
      }),
    };

    const filename = `warehouse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(exportData, null, 2));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
