import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '@/auth/auth-provider';
import { SyncStore } from '@/data/sync-store';
import { remoteForUser } from '@/data/remote';
import type { DataSnapshot, Mutation } from '@/data/types';

const loading: DataSnapshot = { tasks: [], habits: [], ready: false, status: 'loading', error: null, pending: 0 };
type Data = DataSnapshot & { mutate: (op: Omit<Mutation, 'mutationId'>) => void; synchronize: () => Promise<void> };
const Context = createContext<Data | null>(null);
const loadingContext: Data = { ...loading, mutate: () => {}, synchronize: async () => {} };
export function DataProvider({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  return ready ? <ScopedData key={`lists-v2:${session?.user.id ?? 'guest'}`} owner={session?.user.id ?? null}>{children}</ScopedData> : <Context.Provider value={loadingContext}>{children}</Context.Provider>;
}
function ScopedData({ owner, children }: { owner: string | null; children: ReactNode }) {
  const [store] = useState(() => {
    const storage = {
      getItem: AsyncStorage.getItem, setItem: AsyncStorage.setItem,
      exclusive: Platform.OS === 'web' && typeof window !== 'undefined' && navigator.locks
        ? (work: () => Promise<void>) => navigator.locks.request('mejordia-guest-transfer', work) : undefined,
    };
    return new SyncStore(owner, storage, owner ? remoteForUser(owner) : null);
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => loading);
  useEffect(() => {
    void store.start();
    const refresh = () => { if (AppState.currentState === 'active') void store.synchronize(); };
    const listener = AppState.addEventListener('change', refresh);
    const timer = owner ? setInterval(refresh, 30000) : null;
    if (Platform.OS === 'web') window.addEventListener('focus', refresh);
    return () => { store.stop(); listener.remove(); if (timer) clearInterval(timer); if (Platform.OS === 'web') window.removeEventListener('focus', refresh); };
  }, [store, owner]);
  function mutate(op: Omit<Mutation, 'mutationId'>) {
    store.enqueue({ ...op, mutationId: `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` });
  }
  return <Context.Provider value={{ ...snapshot, mutate, synchronize: store.synchronize }}>{children}</Context.Provider>;
}
export function useData() {
  const value = useContext(Context);
  if (!value) throw new Error('DataProvider is required');
  return value;
}
