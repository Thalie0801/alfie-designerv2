import { useState, useEffect, useCallback } from 'react';

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Storage full or unavailable
    }
  }, [key, state]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const nextValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      return nextValue;
    });
  }, []);

  return [state, setValue];
}
