import type { Container, Position, PositionTransaction } from './types';

const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const path = url.startsWith('/') ? url : `/${url}`;
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    const err = isJson
      ? await res.json().catch(() => ({ error: res.statusText }))
      : { error: res.statusText || `Request failed (${res.status})` };
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  if (!isJson) {
    throw new Error('Server returned non-JSON response. Is the API running?');
  }
  return res.json();
}

export const containersApi = {
  list: (openOnly = false) =>
    fetchApi<Container[]>(`/containers${openOnly ? '?open=true' : ''}`),
  get: (id: string) => fetchApi<Container>(`/containers/${id}`),
  getByNumber: (number: string) =>
    fetchApi<Container>(`/containers/by-number/${encodeURIComponent(number)}`),
  create: (containerNumber: string) =>
    fetchApi<Container>('/containers', {
      method: 'POST',
      body: JSON.stringify({ containerNumber }),
    }),
  update: (id: string, containerNumber: string) =>
    fetchApi<Container>(`/containers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ containerNumber }),
    }),
  close: (id: string) =>
    fetchApi<Container>(`/containers/${id}/close`, { method: 'PATCH' }),
  delete: (id: string) =>
    fetchApi<void>(`/containers/${id}`, { method: 'DELETE' }),
};

export const positionsApi = {
  list: (containerId: string) =>
    fetchApi<Position[]>(`/positions?containerId=${containerId}`),
  create: (data: {
    containerId: string;
    positionNumber: number;
    name: string;
    totalQuantity: number;
    weight?: number;
    volume?: number;
    description?: string;
  }) =>
    fetchApi<Position>('/positions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Position>) =>
    fetchApi<Position>(`/positions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<void>(`/positions/${id}`, { method: 'DELETE' }),
  adjust: (id: string, delta: number, operatorName: string) =>
    fetchApi<{ position: Position; lastTransaction: PositionTransaction | null }>(
      `/positions/${id}/adjust`,
      {
        method: 'POST',
        body: JSON.stringify({ delta, operatorName }),
      }
    ),
  getTransactions: (id: string) =>
    fetchApi<PositionTransaction[]>(`/positions/${id}/transactions`),
};
