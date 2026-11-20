import { useCallback, useState } from "react";

/** Keeps a form draft in this browser only. Local storage can be empty or blocked, so every call is guarded. */
export function useLocalDraft<T>(key: string, initial: T): [T, (next: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? ({ ...initial, ...JSON.parse(raw) } as T) : initial;
    } catch {
      return initial;
    }
  });
  const save = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable: the draft lives in memory only */
      }
    },
    [key],
  );
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);
  return [value, save, clear];
}
