import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useData } from '@/data/data-provider';
import { dayKey, habitAttentionKeys } from '@/models/habit';

const Context = createContext(false);

export function HabitAttentionProvider({ owner, children }: { owner: string; children: ReactNode }) {
  const { habits, ready } = useData();
  const pathname = usePathname();
  const viewing = pathname === '/habitos';
  const [today, setToday] = useState(dayKey());
  const [seen, setSeen] = useState<string[] | null>(null);
  const writes = useRef(Promise.resolve());
  const storageKey = `mejordia.habit-attention.${owner}.v1`;
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then((raw) => {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (active) setSeen(Array.isArray(parsed) && parsed.every((key) => typeof key === 'string') ? parsed : []);
    }).catch(() => { if (active) setSeen([]); });
    return () => { active = false; };
  }, [storageKey]);
  useEffect(() => {
    const refresh = () => setToday(dayKey());
    const timer = setInterval(refresh, 30000);
    const listener = AppState.addEventListener('change', refresh);
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  const keys = useMemo(() => habitAttentionKeys(habits, today), [habits, today]);
  const unread = ready && seen !== null && keys.some((key) => !seen.includes(key));
  useEffect(() => {
    if (!viewing || !unread || !seen) return;
    const next = [...new Set([...seen, ...keys])];
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(storageKey, JSON.stringify(next)))
      .catch(() => {})
      .then(() => setSeen((current) => [...new Set([...(current ?? []), ...next])]));
  }, [viewing, unread, seen, keys, storageKey]);
  return <Context.Provider value={!viewing && unread}>{children}</Context.Provider>;
}

export function useHabitAttention() { return useContext(Context); }
