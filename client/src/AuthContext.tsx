import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  getStoredSessionUuid,
  clearSession,
  getUserByUuid,
} from './services/authService';
import { getSettings } from './services/settingsService';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logout: () => void;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyTheme(appearance: string | undefined) {
  if (appearance === 'system') {
    document.documentElement.dataset.theme = 'system';
  } else if (appearance === 'light' || appearance === 'dark') {
    document.documentElement.dataset.theme = appearance;
  } else {
    document.documentElement.dataset.theme = 'dark';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uuid = getStoredSessionUuid();
    if (!uuid) {
      setLoading(false);
      return;
    }
    getUserByUuid(uuid)
      .then(async (u) => {
        setUserState(u);
        if (u) {
          const settings = await getSettings(u.uuid);
          applyTheme(settings.appearance);
        }
      })
      .catch(() => {
        clearSession();
        setUserState(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    getSettings(user.uuid).then((s) => applyTheme(s.appearance));
  }, [user]);

  const logout = useCallback(() => {
    clearSession();
    setUserState(null);
  }, []);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
  }, []);

  const refreshUser = useCallback(async () => {
    const uuid = getStoredSessionUuid();
    if (!uuid) return;
    const fresh = await getUserByUuid(uuid);
    setUserState(fresh);
  }, []);

  const value = useMemo(
    () => ({ user, loading, logout, setUser, refreshUser }),
    [user, loading, logout, setUser, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
