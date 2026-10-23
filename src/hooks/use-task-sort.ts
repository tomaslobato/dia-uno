import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compareTaskDueDate, mergeOrderWithTasks, sortTasksByOrder, type Task } from '@/models/task';

export type TaskSortMode = 'date' | 'manual';

type StoredSort = { mode: TaskSortMode; orders: Record<string, string[]> };

const STORAGE_KEY = 'tareas.sort.v1';

function isSortMode(value: unknown): value is TaskSortMode {
  return value === 'date' || value === 'manual';
}

export function useTaskSort(orderKey: string) {
  const [mode, setModeState] = useState<TaskSortMode>('date');
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [ready, setReady] = useState(false);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!active) return;
      if (raw) {
        const stored = JSON.parse(raw) as StoredSort;
        if (!isSortMode(stored.mode) || !stored.orders || typeof stored.orders !== 'object') throw new Error('Invalid sort preference');
        setModeState(stored.mode);
        setOrders(Object.fromEntries(Object.entries(stored.orders).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((id) => typeof id === 'string'))));
      }
      setReady(true);
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    writes.current = writes.current.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, orders } as StoredSort))).catch(() => {});
  }, [mode, orders, ready]);

  const setMode = useCallback((next: TaskSortMode, seedTasks?: Task[]) => {
    if (next === 'manual' && seedTasks) {
      setOrders((current) => {
        const existing = current[orderKey];
        if (existing?.length) return { ...current, [orderKey]: mergeOrderWithTasks(existing, seedTasks) };
        return { ...current, [orderKey]: seedTasks.map((task) => task.id) };
      });
    }
    setModeState(next);
  }, [orderKey]);

  const reorder = useCallback((ids: string[]) => {
    setOrders((current) => ({ ...current, [orderKey]: ids }));
    setModeState('manual');
  }, [orderKey]);

  const sortPending = useCallback((tasks: Task[]) => {
    if (mode === 'date') return [...tasks].sort(compareTaskDueDate);
    return sortTasksByOrder(tasks, mergeOrderWithTasks(orders[orderKey] ?? [], tasks));
  }, [mode, orderKey, orders]);

  const orderIds = useMemo(() => orders[orderKey] ?? [], [orderKey, orders]);

  return { mode, setMode, reorder, sortPending, orderIds, ready };
}
