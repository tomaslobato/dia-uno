import { parseTaskLists, type TaskList } from '../models/task-list.ts';
import { parseTasks } from '../models/task.ts';
import { parseHabits } from '../models/habit.ts';
import { applyMutation, projectRecords } from './records.ts';
import type { DataSnapshot, Mutation, Records } from './types';

export type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown>; exclusive?: (work: () => Promise<void>) => Promise<void> };
export type Remote = { sync: (pending: Mutation[]) => Promise<Records> };
type Cache = { version: 1; owner: string | null; base: Records; pending: Mutation[]; legacyImported: boolean };
const empty = (): Records => ({ tasks: [], habits: [], lists: [] });
const TRANSFER_KEY = 'mejordia.guest-transfer.v1';
let migrationQueue: Promise<unknown> = Promise.resolve();
const LEGACY_OWNER = 'mejordia.legacy-owner.v1';
export const cacheKey = (owner: string | null) => `mejordia.data.${owner ?? 'guest'}.v1`;
const initialSnapshot = (): DataSnapshot => ({ ...empty(), ready: false, status: 'loading', pending: 0, error: null });

export function parseCache(raw: string, owner: string | null): Cache {
  const value = JSON.parse(raw) as Cache;
  if (value?.version !== 1 || value.owner !== owner || typeof value.legacyImported !== 'boolean' || !Array.isArray(value.pending) || !value.base || !Array.isArray(value.base.tasks) || !Array.isArray(value.base.habits)) throw new Error('Caché inválida');
  // A store kept alive across Fast Refresh can use the previous two-entity reducer.
  // Recover only generated lists; other malformed records still fail closed.
  const recovered: TaskList[] = [];
  const habits = value.base.habits.filter((item) => {
    const candidate = item as unknown as Partial<TaskList> & { completedDays?: unknown; intervalDays?: unknown; createdOn?: unknown };
    if (typeof candidate?.id === 'string' && candidate.id.startsWith('list-') && candidate.completedDays === undefined && candidate.intervalDays === undefined && candidate.createdOn === undefined) {
      try { recovered.push(parseTaskLists([candidate])[0]); return false; } catch { /* Validate as a habit below. */ }
    }
    return true;
  });
  const lists = [...parseTaskLists(value.base.lists)];
  for (const list of recovered) if (!lists.some((item) => item.id === list.id)) lists.push(list);
  const base = { lists, tasks: parseTasks(JSON.stringify(value.base.tasks)), habits: parseHabits(JSON.stringify(habits)) };
  for (const op of value.pending) {
    if (!op || typeof op.id !== 'string' || !op.id || typeof op.mutationId !== 'string' || !op.mutationId || !['tasks', 'habits', 'lists'].includes(op.entity) || !['create', 'import', 'patch', 'delete', 'day'].includes(op.action)) throw new Error('Cambios pendientes inválidos');
    if (op.action === 'create' || op.action === 'import') {
      if (op.entity === 'lists') op.item = parseTaskLists([op.item])[0]; else if (op.entity === 'tasks') op.item = parseTasks(JSON.stringify([op.item]))[0]; else op.item = parseHabits(JSON.stringify([op.item]))[0];
      if (op.item?.id !== op.id) throw new Error('Cambio pendiente inválido');
    }
    if (op.action === 'patch' && (!op.patch || typeof op.patch !== 'object')) throw new Error('Cambio pendiente inválido');
    if (op.action === 'day' && (op.entity !== 'habits' || typeof op.done !== 'boolean' || typeof op.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(op.day))) throw new Error('Día pendiente inválido');
  }
  const projected = projectRecords(base, value.pending);
  parseTaskLists(projected.lists); parseTasks(JSON.stringify(projected.tasks)); parseHabits(JSON.stringify(projected.habits));
  return { ...value, base };
}

export class SyncStore {
  private cache: Cache;
  private snapshot = initialSnapshot();
  private listeners = new Set<() => void>();
  private writes: Promise<unknown> = Promise.resolve();
  private working: Promise<void> | null = null;
  private active = false;
  private generation = 0;
  private initialized = false;
  private owner: string | null;
  private storage: Storage;
  private remote: Remote | null;
  constructor(owner: string | null, storage: Storage, remote: Remote | null) {
    this.owner = owner; this.storage = storage; this.remote = remote;
    this.cache = { version: 1, owner, base: empty(), pending: [], legacyImported: false };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(status = this.snapshot.status, error: string | null = this.snapshot.error) {
    this.snapshot = { ...projectRecords(this.cache.base, this.cache.pending), ready: this.initialized, status, pending: this.cache.pending.length, error };
    this.listeners.forEach((listener) => listener());
  }
  private persist() {
    const raw = JSON.stringify(this.cache);
    this.writes = this.writes.catch(() => undefined).then(() => this.storage.setItem(cacheKey(this.owner), raw));
    return this.writes;
  }
  async start() {
    this.active = true;
    const generation = ++this.generation;
    const alive = () => this.active && generation === this.generation;
    if (this.initialized) { this.publish(); await this.synchronize(); return; }
    try {
      const raw = await this.storage.getItem(cacheKey(this.owner));
      if (!alive()) return;
      if (raw) this.cache = parseCache(raw, this.owner);
      const legacyOwner = await this.storage.getItem(LEGACY_OWNER);
      if (!alive()) return;
      if (!this.owner && !raw && !legacyOwner) {
        const [tasks, habits] = await Promise.all([this.storage.getItem('tareas.tasks.v1'), this.storage.getItem('tareas.habits.v1')]);
        if (!alive()) return;
        this.cache.base = { tasks: parseTasks(tasks), habits: parseHabits(habits) };
      }
      if (!this.owner) {
        const transferRaw = await this.storage.getItem(TRANSFER_KEY);
        const transfer = transferRaw ? JSON.parse(transferRaw) : null;
        if (transfer) {
          const ids = new Set([...transfer.records.tasks, ...transfer.records.habits, ...(transfer.records.lists ?? [])].map((item: { id: string }) => item.id));
          this.cache.base = { lists: (this.cache.base.lists ?? []).filter((list) => !ids.has(list.id)), tasks: this.cache.base.tasks.filter((task) => !ids.has(task.id)), habits: this.cache.base.habits.filter((habit) => !ids.has(habit.id)) };
        }
      } else {
        // Serialize claims within the app. The provider also supplies a browser lock.
        const previous = migrationQueue;
        const job = previous.catch(() => undefined).then(() => this.storage.exclusive ? this.storage.exclusive(() => this.importGuest(alive)) : this.importGuest(alive));
        migrationQueue = job;
        await job;
      }
      if (!alive()) return;
      await this.persist();
      if (!alive()) return;
      this.initialized = true;
      this.publish(this.owner ? 'pending' : 'local', null);
      await this.synchronize();
    } catch {
      if (alive()) this.publish('error', 'No pudimos abrir tus datos locales. No se reemplazaron. Vuelve a abrir la app.');
    }
  }
  private async importGuest(alive: () => boolean) {
    const owner = this.owner!;
    if (!alive()) return;
    const raw = await this.storage.getItem(TRANSFER_KEY);
    let transfer = raw ? JSON.parse(raw) as { owner: string; transferId: string; records: Records } | null : null;
    if (transfer && transfer.owner !== owner) return;
    if (!transfer) {
      const guestRaw = await this.storage.getItem(cacheKey(null));
      let records = empty();
      if (guestRaw) { const guest = parseCache(guestRaw, null); records = projectRecords(guest.base, guest.pending); }
      else if (!await this.storage.getItem(LEGACY_OWNER)) {
        const [tasks, habits] = await Promise.all([this.storage.getItem('tareas.tasks.v1'), this.storage.getItem('tareas.habits.v1')]);
        records = { tasks: parseTasks(tasks), habits: parseHabits(habits) };
      }
      if (!alive() || !records.tasks.length && !records.habits.length && !records.lists?.length) return;
      transfer = { owner, records, transferId: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
      // This receipt is written first; interrupted moves remain bound to their owner.
      await this.storage.setItem(TRANSFER_KEY, JSON.stringify(transfer));
      await this.storage.setItem(LEGACY_OWNER, owner);
      await this.storage.setItem(`mejordia.guest-backup.${transfer.transferId}`, JSON.stringify(records));
      await this.storage.setItem(cacheKey(null), JSON.stringify({ version: 1, owner: null, base: empty(), pending: [], legacyImported: true } satisfies Cache));
    }
    if (!alive()) return;
    // Validate the retained snapshot before importing any records.
    const records = { lists: parseTaskLists(transfer.records.lists), tasks: parseTasks(JSON.stringify(transfer.records.tasks)), habits: parseHabits(JSON.stringify(transfer.records.habits)) };
    // Finish interrupted source cleanup, retaining any newer anonymous records.
    const guestRaw = await this.storage.getItem(cacheKey(null));
    if (guestRaw) {
      const guest = parseCache(guestRaw, null);
      const taskIds = new Set(records.tasks.map((task) => task.id));
      const habitIds = new Set(records.habits.map((habit) => habit.id));
      guest.base = { lists: (guest.base.lists ?? []).filter((list) => !records.lists.some((item) => item.id === list.id)), tasks: guest.base.tasks.filter((task) => !taskIds.has(task.id)), habits: guest.base.habits.filter((habit) => !habitIds.has(habit.id)) };
      await this.storage.setItem(cacheKey(null), JSON.stringify(guest));
    }
    for (const entity of ['lists', 'tasks', 'habits'] as const) for (const item of records[entity] ?? []) {
      const mutationId = `guest:${transfer.transferId}:${entity}:${item.id}`;
      if (!this.cache.pending.some((op) => op.mutationId === mutationId)) this.cache.pending.push({ entity, id: item.id, item, action: 'import', mutationId });
    }
    this.cache.legacyImported = true;
    await this.persist();
    // Only clear the move receipt after the destination outbox is durable.
    await this.storage.setItem(TRANSFER_KEY, 'null');
  }
  stop() { this.active = false; this.generation++; }
  enqueue(mutation: Mutation) {
    if (!this.initialized || !this.active) return;
    if (this.owner) this.cache.pending = [...this.cache.pending, mutation];
    else this.cache.base = applyMutation(this.cache.base, mutation);
    this.publish(this.owner ? 'pending' : 'local', null);
    void this.persist().then(() => {
      if (this.active) void this.synchronize();
    }).catch(() => {
      if (this.active) this.publish('error', 'No pudimos guardar en este dispositivo. Mantén la app abierta y vuelve a intentar.');
    });
  }
  synchronize = async (): Promise<void> => {
    if (!this.active || !this.initialized || !this.owner || !this.remote) return;
    if (this.working) return this.working;
    const generation = this.generation;
    const alive = () => this.active && generation === this.generation;
    this.working = (async () => {
      try {
        do {
          await this.persist();
          if (!alive()) return;
          const batch = this.cache.pending.slice(0, 100);
          this.publish('syncing', null);
          const data = await this.remote!.sync(batch);
          if (!alive()) return;
          const acknowledged = new Set(batch.map((op) => op.mutationId));
          this.cache.base = data;
          this.cache.pending = this.cache.pending.filter((op) => !acknowledged.has(op.mutationId));
          await this.persist();
          if (!alive()) return;
          this.publish(this.cache.pending.length ? 'pending' : 'synced', null);
        } while (this.cache.pending.length && alive());
      } catch (cause) {
        if (!alive()) return;
        this.publish('error', cause instanceof Error ? cause.message : 'No pudimos sincronizar. Tus cambios siguen pendientes en este dispositivo.');
      }
    })();
    try { await this.working; } finally { this.working = null; }
  };
}
