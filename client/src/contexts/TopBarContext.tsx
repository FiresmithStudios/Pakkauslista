import { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface TopBarContextValue {
  title: string;
  setTitle: (t: string) => void;
}

const TopBarContext = createContext<TopBarContextValue | null>(null);

export function TopBarProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitleState] = useState('Kontit');
  const setTitle = useCallback((t: string) => setTitleState(t), []);
  const value = useMemo(() => ({ title, setTitle }), [title, setTitle]);
  return (
    <TopBarContext.Provider value={value}>
      {children}
    </TopBarContext.Provider>
  );
}

export function useTopBar() {
  const ctx = useContext(TopBarContext);
  return ctx ?? { title: '', setTitle: () => {} };
}
