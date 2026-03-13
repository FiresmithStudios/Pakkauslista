import { get, ref, set } from 'firebase/database';
import { db } from '../firebase';
import type { UserSettings } from '../types';

export async function getSettings(userUuid: string): Promise<UserSettings> {
  const settingsRef = ref(db, `users/${userUuid}/settings`);
  const snapshot = await get(settingsRef);
  const data = snapshot.val();
  return data ?? {};
}

export async function updateSettings(
  userUuid: string,
  updates: Partial<UserSettings>
): Promise<UserSettings> {
  const settingsRef = ref(db, `users/${userUuid}/settings`);
  const current = await getSettings(userUuid);
  const merged = { ...current, ...updates };
  await set(settingsRef, merged);
  return merged;
}
