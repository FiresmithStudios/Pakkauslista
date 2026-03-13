import { ref, set } from 'firebase/database';
import { db } from '../firebase';
import type { AuditEvent } from '../types';

function uuid() {
  return crypto.randomUUID();
}

export async function logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
  const id = uuid();
  const fullEvent: AuditEvent = {
    ...event,
    id,
    timestamp: Date.now(),
  };
  await set(ref(db, `events/${id}`), {
    userUuid: fullEvent.userUuid,
    action: fullEvent.action,
    timestamp: fullEvent.timestamp,
    positionId: fullEvent.positionId ?? null,
    containerId: fullEvent.containerId ?? null,
    quantityChange: fullEvent.quantityChange ?? null,
    metadata: fullEvent.metadata ?? null,
  });
}
