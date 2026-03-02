import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list } from '@vercel/blob';

const BLOB_PATH = 'warehouse-data.json';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: 'warehouse' });
      const blob = blobs.find((b) => b.pathname === BLOB_PATH);
      if (!blob) {
        return res.status(200).json({
          containers: [],
          positions: [],
          transactions: [],
        });
      }
      const res = await fetch(blob.url);
      const text = await res.text();
      const parsed = JSON.parse(text || '{}');
      return res.status(200).json({
        containers: parsed.containers ?? [],
        positions: parsed.positions ?? [],
        transactions: parsed.transactions ?? [],
      });
    }

    if (req.method === 'PUT') {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
      const json = JSON.stringify({
        containers: body.containers ?? [],
        positions: body.positions ?? [],
        transactions: body.transactions ?? [],
      });
      await put(BLOB_PATH, json, {
        access: 'public',
        addRandomSuffix: false,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
