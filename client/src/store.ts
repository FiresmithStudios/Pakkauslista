import {
  ref,
  onValue,
  set,
  update,
  remove,
  get,
  type Unsubscribe,
} from 'firebase/database';
import { db } from './firebase';
import type { Container, Position, PositionTransaction } from './types';

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

/** Firebase rejects undefined – strip those keys before writing */
function sanitize<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

// --- Real-time subscriptions ---

export function subscribeToContainers(
  openOnly: boolean,
  callback: (containers: Container[]) => void
): Unsubscribe {
  const containersRef = ref(db, 'containers');
  return onValue(containersRef, (snapshot) => {
    const data = snapshot.val();
    let list: Container[] = [];
    if (data) {
      list = Object.entries(data).map(([id, v]) => ({
        id,
        ...(v as Omit<Container, 'id'>),
      }));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (openOnly) list = list.filter((c) => !c.isClosed);
    }
    callback(list);
  });
}

export function subscribeToPositions(
  containerId: string,
  callback: (positions: Position[]) => void
): Unsubscribe {
  const positionsRef = ref(db, 'positions');
  return onValue(positionsRef, (snapshot) => {
    const data = snapshot.val();
    let list: Position[] = [];
    if (data) {
      list = Object.entries(data)
        .map(([id, v]) => ({ id, ...(v as Omit<Position, 'id'>) }))
        .filter((p) => p.containerId === containerId)
        .sort((a, b) => a.positionNumber - b.positionNumber);
    }
    callback(list);
  });
}

export function subscribeToPosition(
  positionId: string,
  containerId: string,
  callback: (position: Position | null) => void
): Unsubscribe {
  const positionsRef = ref(db, 'positions');
  return onValue(positionsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data || !data[positionId]) {
      callback(null);
      return;
    }
    const p = data[positionId];
    if (p.containerId !== containerId) {
      callback(null);
      return;
    }
    callback({ id: positionId, ...p });
  });
}

export function subscribeToTransactions(
  positionId: string,
  callback: (transactions: PositionTransaction[]) => void
): Unsubscribe {
  const txRef = ref(db, 'position_transactions');
  return onValue(txRef, (snapshot) => {
    const data = snapshot.val();
    let list: PositionTransaction[] = [];
    if (data) {
      list = Object.entries(data)
        .map(([id, v]) => ({ id, ...(v as Omit<PositionTransaction, 'id'>) }))
        .filter((t) => t.positionId === positionId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    callback(list);
  });
}

// --- Mutations ---

export const containersApi = {
  list: async (openOnly = false): Promise<Container[]> => {
    const snap = await get(ref(db, 'containers'));
    const data = snap.val();
    if (!data) return [];
    let list = Object.entries(data).map(([id, v]) => ({
      id,
      ...(v as Omit<Container, 'id'>),
    }));
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (openOnly) list = list.filter((c) => !c.isClosed);
    return list;
  },

  get: async (id: string): Promise<Container> => {
    const byId = await get(ref(db, `containers/${id}`));
    if (byId.exists()) {
      return { id, ...byId.val() };
    }
    const snap = await get(ref(db, 'containers'));
    const data = snap.val();
    if (data) {
      const found = Object.entries(data).find(
        ([_, v]) => (v as Container).containerNumber === id
      );
      if (found) return { id: found[0], ...(found[1] as Omit<Container, 'id'>) };
    }
    throw new Error('Container not found');
  },

  getByNumber: async (number: string): Promise<Container> => {
    const snap = await get(ref(db, 'containers'));
    const data = snap.val();
    if (data) {
      const found = Object.entries(data).find(
        ([_, v]) => (v as Container).containerNumber === number
      );
      if (found) return { id: found[0], ...(found[1] as Omit<Container, 'id'>) };
    }
    throw new Error('Container not found');
  },

  create: async (containerNumber: string): Promise<Container> => {
    const snap = await get(ref(db, 'containers'));
    const data = snap.val() ?? {};
    const exists = Object.values(data).some(
      (v) => (v as Container).containerNumber === containerNumber
    );
    if (exists) throw new Error('Container number already exists');
    const id = uuid();
    const container: Omit<Container, 'id'> = {
      containerNumber: containerNumber.trim(),
      createdAt: now(),
      isClosed: false,
    };
    await set(ref(db, `containers/${id}`), container);
    return { id, ...container };
  },

  update: async (id: string, containerNumber: string): Promise<Container> => {
    const c = await containersApi.get(id);
    const snap = await get(ref(db, 'containers'));
    const data = snap.val() ?? {};
    const exists = Object.entries(data).some(
      ([k, v]) => k !== c.id && (v as Container).containerNumber === containerNumber.trim()
    );
    if (exists) throw new Error('Container number already exists');
    await update(ref(db, `containers/${c.id}`), {
      containerNumber: containerNumber.trim(),
    });
    return { ...c, containerNumber: containerNumber.trim() };
  },

  close: async (id: string): Promise<Container> => {
    const c = await containersApi.get(id);
    await update(ref(db, `containers/${c.id}`), { isClosed: true });
    return { ...c, isClosed: true };
  },

  delete: async (id: string): Promise<void> => {
    const c = await containersApi.get(id);
    const positionsSnap = await get(ref(db, 'positions'));
    const positions = positionsSnap.val() ?? {};
    const posIds = Object.entries(positions)
      .filter(([_, p]) => (p as Position).containerId === c.id)
      .map(([id]) => id);
    const txSnap = await get(ref(db, 'position_transactions'));
    const txs = txSnap.val() ?? {};
    for (const txId of Object.keys(txs)) {
      if (posIds.includes((txs as Record<string, PositionTransaction>)[txId].positionId)) {
        await remove(ref(db, `position_transactions/${txId}`));
      }
    }
    for (const posId of posIds) {
      await remove(ref(db, `positions/${posId}`));
    }
    await remove(ref(db, `containers/${c.id}`));
  },
};

export const positionsApi = {
  list: async (containerId: string): Promise<Position[]> => {
    const snap = await get(ref(db, 'positions'));
    const data = snap.val();
    if (!data) return [];
    return Object.entries(data)
      .map(([id, v]) => ({ id, ...(v as Omit<Position, 'id'>) }))
      .filter((p) => p.containerId === containerId)
      .sort((a, b) => a.positionNumber - b.positionNumber);
  },

  create: async (data: {
    containerId: string;
    positionNumber: number;
    name: string;
    totalQuantity: number;
    weight?: number;
    volume?: number;
    description?: string;
  }): Promise<Position> => {
    const snap = await get(ref(db, 'positions'));
    const positions = snap.val() ?? {};
    const exists = Object.values(positions).some(
      (p) =>
        (p as Position).containerId === data.containerId &&
        (p as Position).positionNumber === data.positionNumber
    );
    if (exists) throw new Error('Position number already exists in this container');
    const id = uuid();
    const position: Omit<Position, 'id'> = {
      containerId: data.containerId,
      positionNumber: data.positionNumber,
      name: data.name.trim(),
      totalQuantity: data.totalQuantity,
      packedQuantity: 0,
      weight: data.weight,
      volume: data.volume,
      description: data.description,
      updatedAt: now(),
    };
    await set(ref(db, `positions/${id}`), sanitize(position as Record<string, unknown>));
    return { id, ...position };
  },

  update: async (id: string, data: Partial<Position>): Promise<Position> => {
    const snap = await get(ref(db, `positions/${id}`));
    if (!snap.exists()) throw new Error('Position not found');
    const p = { id, ...snap.val() } as Position;
    const updates: Record<string, unknown> = { updatedAt: now() };
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.totalQuantity !== undefined) updates.totalQuantity = data.totalQuantity;
    if (data.weight !== undefined) updates.weight = data.weight;
    if (data.volume !== undefined) updates.volume = data.volume;
    if (data.description !== undefined) updates.description = data.description;
    await update(ref(db, `positions/${id}`), updates);
    return { ...p, ...updates };
  },

  delete: async (id: string): Promise<void> => {
    const txSnap = await get(ref(db, 'position_transactions'));
    const txs = txSnap.val() ?? {};
    for (const txId of Object.keys(txs)) {
      if ((txs as Record<string, PositionTransaction>)[txId].positionId === id) {
        await remove(ref(db, `position_transactions/${txId}`));
      }
    }
    await remove(ref(db, `positions/${id}`));
  },

  adjust: async (
    id: string,
    delta: number,
    operatorName: string
  ): Promise<{ position: Position; lastTransaction: PositionTransaction | null }> => {
    const snap = await get(ref(db, `positions/${id}`));
    if (!snap.exists()) throw new Error('Position not found');
    const p = { id, ...snap.val() } as Position;
    const newPacked = p.packedQuantity + delta;
    if (newPacked < 0) throw new Error('Packed quantity cannot go below 0');
    if (newPacked > p.totalQuantity) throw new Error('Packed quantity cannot exceed total quantity');

    const txId = uuid();
    const tx: Omit<PositionTransaction, 'id'> = {
      positionId: id,
      delta,
      operatorName: operatorName.trim(),
      createdAt: now(),
    };
    await set(ref(db, `position_transactions/${txId}`), tx);
    await update(ref(db, `positions/${id}`), {
      packedQuantity: newPacked,
      updatedAt: now(),
    });

    return {
      position: { ...p, packedQuantity: newPacked, updatedAt: now() },
      lastTransaction: { id: txId, ...tx },
    };
  },

  getTransactions: async (id: string): Promise<PositionTransaction[]> => {
    const snap = await get(ref(db, 'position_transactions'));
    const data = snap.val();
    if (!data) return [];
    return Object.entries(data)
      .map(([txId, v]) => ({ id: txId, ...(v as Omit<PositionTransaction, 'id'>) }))
      .filter((t) => t.positionId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
};

// --- Export / Import ---

export async function exportDataAsync(): Promise<string> {
  const [containersSnap, positionsSnap, txSnap] = await Promise.all([
    get(ref(db, 'containers')),
    get(ref(db, 'positions')),
    get(ref(db, 'position_transactions')),
  ]);
  const containers = containersSnap.val() ?? {};
  const positions = positionsSnap.val() ?? {};
  const transactions = txSnap.val() ?? {};
  const containerList = Object.entries(containers).map(([id, v]) => ({ id, ...(v as Omit<Container, 'id'>) }));
  const positionList = Object.entries(positions).map(([id, v]) => ({ id, ...(v as Omit<Position, 'id'>) }));
  const txList = Object.entries(transactions).map(([id, v]) => ({ id, ...(v as Omit<PositionTransaction, 'id'>) }));
  return JSON.stringify(
    { exportedAt: now(), containers: containerList, positions: positionList, transactions: txList },
    null,
    2
  );
}

export function exportData(): string {
  return JSON.stringify({ exportedAt: now(), containers: [], positions: [], transactions: [] }, null, 2);
}

export async function importData(json: string): Promise<void> {
  const parsed = JSON.parse(json) as {
    containers?: Container[];
    positions?: Position[];
    transactions?: PositionTransaction[];
  };
  const containers = Array.isArray(parsed.containers) ? parsed.containers : [];
  const positions = Array.isArray(parsed.positions) ? parsed.positions : [];
  const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];

  for (const c of containers) {
    await set(ref(db, `containers/${c.id}`), {
      containerNumber: c.containerNumber,
      createdAt: c.createdAt,
      isClosed: c.isClosed,
    });
  }
  for (const p of positions) {
    await set(ref(db, `positions/${p.id}`), sanitize({
      containerId: p.containerId,
      positionNumber: p.positionNumber,
      name: p.name,
      totalQuantity: p.totalQuantity,
      packedQuantity: p.packedQuantity,
      weight: p.weight,
      volume: p.volume,
      description: p.description,
      updatedAt: p.updatedAt,
    }));
  }
  for (const t of transactions) {
    await set(ref(db, `position_transactions/${t.id}`), {
      positionId: t.positionId,
      delta: t.delta,
      operatorName: t.operatorName,
      createdAt: t.createdAt,
    });
  }
}
