import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Container, Position, PositionTransaction } from './types';

const STORAGE_KEY = 'warehouse-packing-data';
const FILE_PATH = 'data.json';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

interface Store {
  containers: Container[];
  positions: Position[];
  transactions: PositionTransaction[];
}

async function fetchFromCloud(): Promise<Store | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage.from('warehouse').download(FILE_PATH);
    if (error || !data) return null;
    const text = await data.text();
    const parsed = JSON.parse(text || '{}');
    return {
      containers: parsed.containers ?? [],
      positions: parsed.positions ?? [],
      transactions: parsed.transactions ?? [],
    };
  } catch {
    return null;
  }
}

async function saveToCloud(store: Store): Promise<boolean> {
  if (!supabase) return false;
  try {
    const json = JSON.stringify(store);
    const { error } = await supabase.storage.from('warehouse').upload(FILE_PATH, json, {
      contentType: 'application/json',
      upsert: true,
    });
    return !error;
  } catch {
    return false;
  }
}

function loadLocal(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed.containers && parsed.positions && parsed.transactions) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { containers: [], positions: [], transactions: [] };
}

function saveLocal(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

let cachedStore: Store | null = null;

async function load(): Promise<Store> {
  const cloud = await fetchFromCloud();
  if (cloud) {
    cachedStore = cloud;
    saveLocal(cloud);
    return cloud;
  }
  cachedStore = loadLocal();
  return cachedStore;
}

async function save(store: Store) {
  saveLocal(store);
  cachedStore = store;
  await saveToCloud(store);
}

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

export const containersApi = {
  list: async (openOnly = false): Promise<Container[]> => {
    const s = await load();
    let list = [...s.containers].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (openOnly) list = list.filter((c) => !c.isClosed);
    return list;
  },

  get: async (id: string): Promise<Container> => {
    const s = await load();
    const c = s.containers.find((x) => x.id === id || x.containerNumber === id);
    if (!c) throw new Error('Container not found');
    return c;
  },

  getByNumber: async (number: string): Promise<Container> => {
    const s = await load();
    const c = s.containers.find((x) => x.containerNumber === number);
    if (!c) throw new Error('Container not found');
    return c;
  },

  create: async (containerNumber: string): Promise<Container> => {
    const s = await load();
    const exists = s.containers.some((c) => c.containerNumber === containerNumber);
    if (exists) throw new Error('Container number already exists');
    const container: Container = {
      id: uuid(),
      containerNumber: containerNumber.trim(),
      createdAt: now(),
      isClosed: false,
    };
    s.containers.push(container);
    await save(s);
    return container;
  },

  update: async (id: string, containerNumber: string): Promise<Container> => {
    const s = await load();
    const c = s.containers.find((x) => x.id === id || x.containerNumber === id);
    if (!c) throw new Error('Container not found');
    const exists = s.containers.some(
      (x) => x.containerNumber === containerNumber.trim() && x.id !== c.id
    );
    if (exists) throw new Error('Container number already exists');
    c.containerNumber = containerNumber.trim();
    await save(s);
    return c;
  },

  close: async (id: string): Promise<Container> => {
    const s = await load();
    const c = s.containers.find((x) => x.id === id || x.containerNumber === id);
    if (!c) throw new Error('Container not found');
    c.isClosed = true;
    await save(s);
    return c;
  },

  delete: async (id: string): Promise<void> => {
    const s = await load();
    const c = s.containers.find((x) => x.id === id || x.containerNumber === id);
    if (!c) throw new Error('Container not found');
    const posIds = s.positions.filter((p) => p.containerId === c.id).map((p) => p.id);
    s.transactions = s.transactions.filter((t) => !posIds.includes(t.positionId));
    s.positions = s.positions.filter((p) => p.containerId !== c.id);
    s.containers = s.containers.filter((x) => x.id !== c.id);
    await save(s);
  },
};

export const positionsApi = {
  list: async (containerId: string): Promise<Position[]> => {
    const s = await load();
    return s.positions
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
    const s = await load();
    const exists = s.positions.some(
      (p) => p.containerId === data.containerId && p.positionNumber === data.positionNumber
    );
    if (exists) throw new Error('Position number already exists in this container');
    const position: Position = {
      id: uuid(),
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
    s.positions.push(position);
    await save(s);
    return position;
  },

  update: async (id: string, data: Partial<Position>): Promise<Position> => {
    const s = await load();
    const p = s.positions.find((x) => x.id === id);
    if (!p) throw new Error('Position not found');
    if (data.name !== undefined) p.name = data.name.trim();
    if (data.totalQuantity !== undefined) p.totalQuantity = data.totalQuantity;
    if (data.weight !== undefined) p.weight = data.weight;
    if (data.volume !== undefined) p.volume = data.volume;
    if (data.description !== undefined) p.description = data.description;
    p.updatedAt = now();
    await save(s);
    return p;
  },

  delete: async (id: string): Promise<void> => {
    const s = await load();
    const p = s.positions.find((x) => x.id === id);
    if (!p) throw new Error('Position not found');
    s.transactions = s.transactions.filter((t) => t.positionId !== id);
    s.positions = s.positions.filter((x) => x.id !== id);
    await save(s);
  },

  adjust: async (
    id: string,
    delta: number,
    operatorName: string
  ): Promise<{ position: Position; lastTransaction: PositionTransaction | null }> => {
    const s = await load();
    const p = s.positions.find((x) => x.id === id);
    if (!p) throw new Error('Position not found');
    const newPacked = p.packedQuantity + delta;
    if (newPacked < 0) throw new Error('Packed quantity cannot go below 0');
    if (newPacked > p.totalQuantity) throw new Error('Packed quantity cannot exceed total quantity');

    const tx: PositionTransaction = {
      id: uuid(),
      positionId: id,
      delta,
      operatorName: operatorName.trim(),
      createdAt: now(),
    };
    s.transactions.push(tx);
    p.packedQuantity = newPacked;
    p.updatedAt = now();
    await save(s);

    return {
      position: p,
      lastTransaction: tx,
    };
  },

  getTransactions: async (id: string): Promise<PositionTransaction[]> => {
    const s = await load();
    return s.transactions
      .filter((t) => t.positionId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
};

export function exportData(): string {
  const s = cachedStore ?? loadLocal();
  return JSON.stringify(
    {
      exportedAt: now(),
      containers: s.containers,
      positions: s.positions,
      transactions: s.transactions,
    },
    null,
    2
  );
}

export function importData(json: string): void {
  const parsed = JSON.parse(json) as {
    containers?: Container[];
    positions?: Position[];
    transactions?: PositionTransaction[];
  };
  const store: Store = {
    containers: Array.isArray(parsed.containers) ? parsed.containers : [],
    positions: Array.isArray(parsed.positions) ? parsed.positions : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
  };
  saveLocal(store);
}
