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
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyTheme(appearance: string | undefined) {
  if (appearance === 'system' || !appearance) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = appearance;
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

  const value = useMemo(
    () => ({ user, loading, logout, setUser }),
    [user, loading, logout, setUser]
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
