import { get, ref } from 'firebase/database';
import { db } from '../firebase';
import type { User } from '../types';

const SESSION_KEY = 'user_session_uuid';

export function getStoredSessionUuid(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSession(uuid: string): void {
  localStorage.setItem(SESSION_KEY, uuid);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function loginByPin(pin: string): Promise<User | null> {
  const normalizedPin = pin.replace(/\D/g, '').slice(0, 4);
  if (normalizedPin.length !== 4) return null;

  const usersRef = ref(db, 'users');
  const snapshot = await get(usersRef);
  const data = snapshot.val();
  if (!data) return null;

  const users = Object.entries(data).map(([uuid, v]) => ({
    uuid,
    ...(v as Omit<User, 'uuid'>),
  }));
  const user = users.find((u) => u.pin === normalizedPin) ?? null;
  if (user) {
    setSession(user.uuid);
  }
  return user;
}

export async function getUserByUuid(uuid: string): Promise<User | null> {
  const userRef = ref(db, `users/${uuid}`);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) return null;
  return { uuid, ...snapshot.val() } as User;
}
