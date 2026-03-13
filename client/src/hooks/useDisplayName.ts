import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { getSettings } from '../services/settingsService';

export function useDisplayName(): string {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name ?? '');

  useEffect(() => {
    if (!user) {
      setDisplayName('');
      return;
    }
    getSettings(user.uuid)
      .then((s) => setDisplayName(s.displayName ?? user.name))
      .catch(() => setDisplayName(user.name));
  }, [user]);

  return displayName;
}
