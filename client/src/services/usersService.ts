import { get, ref, update } from 'firebase/database';
import { db } from '../firebase';

export async function getAllUsedPins(excludeUserUuid?: string): Promise<Set<string>> {
  const usersRef = ref(db, 'users');
  const snapshot = await get(usersRef);
  const data = snapshot.val();
  if (!data) return new Set();
  const pins = new Set<string>();
  Object.entries(data).forEach(([uuid, v]) => {
    if (excludeUserUuid && uuid === excludeUserUuid) return;
    const pin = (v as { pin?: string }).pin;
    if (pin) pins.add(pin);
  });
  return pins;
}

export function generateRandomUnusedPin(usedPins: Set<string>): string {
  for (let i = 0; i < 1000; i++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    if (!usedPins.has(pin)) return pin;
  }
  throw new Error('Could not generate unique PIN');
}

export async function updateUserPin(userUuid: string, newPin: string): Promise<void> {
  const pinStr = String(newPin).replace(/\D/g, '').slice(0, 4);
  if (pinStr.length !== 4) throw new Error('PIN must be 4 digits');
  await update(ref(db, `users/${userUuid}`), { pin: pinStr });
}
