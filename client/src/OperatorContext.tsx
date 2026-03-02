import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'warehouse_operator_name';

const OperatorContext = createContext<{
  operatorName: string | null;
  setOperatorName: (name: string) => void;
  clearOperatorName: () => void;
} | null>(null);

export function OperatorProvider({ children }: { children: React.ReactNode }) {
  const [operatorName, setState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (operatorName) {
      localStorage.setItem(STORAGE_KEY, operatorName);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [operatorName]);

  const setOperatorName = useCallback((name: string) => {
    setState(name.trim() || null);
  }, []);

  const clearOperatorName = useCallback(() => {
    setState(null);
  }, []);

  return (
    <OperatorContext.Provider value={{ operatorName, setOperatorName, clearOperatorName }}>
      {children}
    </OperatorContext.Provider>
  );
}

export function useOperator() {
  const ctx = useContext(OperatorContext);
  if (!ctx) throw new Error('useOperator must be used within OperatorProvider');
  return ctx;
}
