export interface Container {
  id: string;
  containerNumber: string;
  createdAt: string;
  isClosed: boolean;
}

export interface Position {
  id: string;
  containerId: string;
  positionNumber: number;
  name: string;
  totalQuantity: number;
  packedQuantity: number;
  notes?: string;
  updatedAt: string;
}

export interface PositionTransaction {
  id: string;
  positionId: string;
  delta: number;
  operatorName: string; // kept for backward compatibility / display
  userUuid?: string; // authenticated user
  createdAt: string;
}

export interface User {
  uuid: string;
  name: string;
  pin: string;
}

export interface UserSettings {
  displayName?: string;
  appearance?: 'light' | 'dark' | 'system';
}

export interface AuditEvent {
  id: string;
  userUuid: string;
  action: string;
  timestamp: number;
  positionId?: string;
  containerId?: string;
  quantityChange?: number;
  metadata?: Record<string, unknown>;
}
