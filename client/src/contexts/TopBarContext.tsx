import { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface TopBarMenuItem {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
}

interface TopBarContextValue {
  title: string;
  setTitle: (t: string) => void;
  menuItems: TopBarMenuItem[];
  setMenuItems: (items: TopBarMenuItem[]) => void;
  clearMenuItems: () => void;
}

const TopBarContext = createContext<TopBarContextValue | null>(null);

export function TopBarProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitleState] = useState('Kontit');
  const [menuItems, setMenuItemsState] = useState<TopBarMenuItem[]>([]);
  const setTitle = useCallback((t: string) => setTitleState(t), []);
  const setMenuItems = useCallback((items: TopBarMenuItem[]) => setMenuItemsState(items), []);
  const clearMenuItems = useCallback(() => setMenuItemsState([]), []);
  const value = useMemo(
    () => ({ title, setTitle, menuItems, setMenuItems, clearMenuItems }),
    [title, setTitle, menuItems, setMenuItems, clearMenuItems]
  );
  return (
    <TopBarContext.Provider value={value}>
      {children}
    </TopBarContext.Provider>
  );
}

export function useTopBar() {
  const ctx = useContext(TopBarContext);
  return ctx ?? { title: '', setTitle: () => {}, menuItems: [], setMenuItems: () => {}, clearMenuItems: () => {} };
}
