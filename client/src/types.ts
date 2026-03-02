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
  weight?: number;
  volume?: number;
  description?: string;
  updatedAt: string;
}

export interface PositionTransaction {
  id: string;
  positionId: string;
  delta: number;
  operatorName: string;
  createdAt: string;
}
