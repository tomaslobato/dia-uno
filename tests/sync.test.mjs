import { createTaskList } from '../src/models/task-list.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTask } from '../src/models/task.ts';
import { DEFAULT_HABIT_COLOR } from '../src/constants/habit-colors.ts';
import { DEFAULT_HABIT_ICON } from '../src/constants/habit-icons.ts';
import { createHabit, parseHabits } from '../src/models/habit.ts';
import { applyMutation, decodeRecords, encodeMutation, projectRecords } from '../src/data/records.ts';
import { SyncStore, cacheKey, parseCache } from '../src/data/sync-store.ts';

const empty = () => ({ tasks: [], habits: [], lists: [] });
const task = () => createTask({ title: 'Leer', description: 'Diez páginas', dueAt: null, hasTime: false });
const habit = (name = 'Caminar', intervalDays = 2, description = '') => createHabit({
  name, description, intervalDays,
  symbol: { type: 'icon', name: DEFAULT_HABIT_ICON },
  color: DEFAULT_HABIT_COLOR,
  kind: 'build',
  reminderTime: null,
  goal: null,
  streakEnabled: true,
});
const mutation = (item, entity = 'tasks', mutationId = 'm1') => ({ entity, item, id: item.id, action: 'create', mutationId });
const tick = () => new Promise((resolve) => setImmediate(resolve));
const copy = (value) => structuredClone(value);
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } };
}
function server() {
  let records = empty();
  let online = true;
  const seen = new Set();
  return {
    setOnline(value) { online = value; }, get data() { return copy(records); },
    set data(value) { records = copy(value); },
    sync: async (operations) => {
      if (!online) throw new Error('Offline');
      for (const op of operations) if (!seen.has(op.mutationId)) { records = applyMutation(records, op); seen.add(op.mutationId); }
      return copy(records);
    },
  };
}
async function drain(store) { await tick(); await store.synchronize(); await tick(); }

test('task wire fields preserve local date/time, date-only tasks and all flags', () => {
  const owner = 'user-a';
  for (const hasTime of [false, true]) {
    const t = { ...task(), dueAt: new Date(2026, 9, 10, 18, 30).toISOString(), hasTime, starred: true, completed: true };
    const fields = encodeMutation(mutation(t)).campos;
    assert.equal(fields.fecha, '2026-10-10');
    assert.equal(fields.hora, hasTime ? '18:30:00' : null);
    const decoded = decodeRecords({ tareas: [{ ...fields, id: t.id, usuario_id: owner }], habitos: [] }, owner).tasks[0];
    assert.equal(decoded.title, t.title); assert.equal(decoded.description, t.description);
    assert.equal(decoded.starred, true); assert.equal(decoded.completed, true);
    const date = new Date(decoded.dueAt);
    assert.equal(date.getDate(), 10); assert.equal(date.getMonth(), 9);
    assert.equal(date.getHours(), hasTime ? 18 : 0);
  }
  assert.deepEqual(encodeMutation({ entity: 'tasks', action: 'patch', id: 't', mutationId: 'p', patch: { starred: true } }).campos, { favorita: true });
  assert.throws(() => decodeRecords({ tareas: [{ usuario_id: 'user-b' }], habitos: [] }, owner));
});
test('task reminder lead time syncs to Supabase and nullable lead time disables it', () => {
  const owner = 'user-a';
  const t = { ...task(), dueAt: new Date(2026, 9, 20, 9, 0).toISOString(), hasTime: true, reminderMinutes: 45 };
  const fields = encodeMutation(mutation(t)).campos;
  assert.equal(fields.recordatorio_minutos, 45);
  const decoded = decodeRecords({ tareas: [{ ...fields, id: t.id, usuario_id: owner }], habitos: [] }, owner).tasks[0];
  assert.equal(decoded.reminderMinutes, 45);
  assert.equal(encodeMutation({ entity: 'tasks', action: 'patch', id: t.id, mutationId: 'p', patch: { reminderMinutes: null } }).campos.recordatorio_minutos, null);
  const legacy = { ...fields }; delete legacy.recordatorio_minutos;
  assert.equal(decodeRecords({ tareas: [{ ...legacy, id: t.id, usuario_id: owner }], habitos: [] }, owner).tasks[0].reminderMinutes, 30);
});
test('old habits gain an empty description and full habits retain history and frequency', () => {
  const h = habit('Caminar', 3, 'En el parque');
  const { description, ...legacy } = h;
  assert.equal(parseHabits(JSON.stringify([legacy]))[0].description, '');
  const fields = encodeMutation(mutation({ ...h, completedDays: ['2026-10-08', '2026-10-10'] }, 'habits')).campos;
  const decoded = decodeRecords({ tareas: [], habitos: [{ ...fields, id: h.id, usuario_id: 'a' }] }, 'a').habits[0];
  assert.equal(decoded.description, 'En el parque'); assert.equal(decoded.intervalDays, 3);
  assert.deepEqual(decoded.completedDays, ['2026-10-08', '2026-10-10']);
  assert.equal(decoded.color, DEFAULT_HABIT_COLOR);
  assert.equal(decoded.kind, 'build');
  assert.deepEqual(decoded.symbol, { type: 'icon', name: DEFAULT_HABIT_ICON });
});
test('offline changes survive restart, then sync once without duplicate records', async () => {
  const storage = memory(); const remote = server(); remote.setOnline(false);
  const first = new SyncStore('a', storage, remote); await first.start();
  const t = task(); first.enqueue(mutation(t));
  first.enqueue({ entity: 'tasks', id: t.id, mutationId: 'm2', action: 'patch', patch: { starred: true, completed: true } });
  await drain(first); assert.equal(first.getSnapshot().pending, 2);
  first.stop();
  const restored = new SyncStore('a', storage, remote); await restored.start();
  assert.equal(restored.getSnapshot().tasks[0].starred, true);
  remote.setOnline(true); await drain(restored); await drain(restored);
  assert.equal(restored.getSnapshot().pending, 0); assert.equal(remote.data.tasks.length, 1);
  assert.equal(remote.data.tasks[0].completed, true); restored.stop();
});
test('pending edits during a network request remain visible and are sent afterwards', async () => {
  const storage = memory(); const remote = server(); const t = task(); remote.data = { tasks: [t], habits: [] };
  const store = new SyncStore('a', storage, remote); await store.start();
  let release; let called;
  const received = new Promise((resolve) => { called = resolve; });
  remote.sync = async (ops) => {
    const snapshot = projectRecords(remote.data, ops);
    if (!release) { called(); await new Promise((resolve) => { release = resolve; }); }
    remote.data = snapshot; return snapshot;
  };
  const syncing = store.synchronize(); await received;
  store.enqueue({ entity: 'tasks', id: t.id, mutationId: 'later', action: 'patch', patch: { description: 'Mientras sincroniza' } });
  assert.equal(store.getSnapshot().tasks[0].description, 'Mientras sincroniza');
  await tick(); release(); await syncing; await drain(store);
  assert.equal(remote.data.tasks[0].description, 'Mientras sincroniza'); assert.equal(store.getSnapshot().pending, 0); store.stop();
});
test('accounts and guest data are separated and original local records migrate only once', async () => {
  const t = task(); const h = habit('Caminar', 2);
  const storage = memory({ 'tareas.tasks.v1': JSON.stringify([t]), 'tareas.habits.v1': JSON.stringify([h]) });
  const guest = new SyncStore(null, storage, null); await guest.start(); assert.equal(guest.getSnapshot().tasks.length, 1); guest.stop();
  const aRemote = server(); const a = new SyncStore('a', storage, aRemote); await a.start();
  assert.equal(aRemote.data.tasks[0].id, t.id); assert.equal(aRemote.data.habits[0].id, h.id); a.stop();
  const bRemote = server(); const b = new SyncStore('b', storage, bRemote); await b.start();
  assert.equal(b.getSnapshot().tasks.length, 0); assert.equal(bRemote.data.tasks.length, 0); b.stop();
  const aAgain = new SyncStore('a', storage, aRemote); await aAgain.start(); assert.equal(aAgain.getSnapshot().tasks.length, 1); assert.equal(aRemote.data.tasks.length, 1); aAgain.stop();
  const guestAgain = new SyncStore(null, storage, null); await guestAgain.start(); assert.equal(guestAgain.getSnapshot().tasks.length, 0); guestAgain.stop();
  assert.equal(storage.values.get('tareas.tasks.v1'), JSON.stringify([t]));
});
test('new anonymous records can migrate on a later login without copying the old account', async () => {
  const storage = memory(); const a = new SyncStore('a', storage, server()); await a.start(); a.stop();
  const guest = new SyncStore(null, storage, null); await guest.start(); const t = task(); guest.enqueue(mutation(t)); await tick(); guest.stop();
  const remote = server(); const b = new SyncStore('b', storage, remote); await b.start(); assert.equal(remote.data.tasks[0].id, t.id); b.stop();
});
test('corrupt caches are not overwritten and cannot be loaded for a different owner', async () => {
  const storage = memory({ [cacheKey('a')]: '{broken' }); const store = new SyncStore('a', storage, server());
  await store.start(); assert.equal(store.getSnapshot().ready, false); assert.equal(storage.values.get(cacheKey('a')), '{broken'); store.stop();
  assert.throws(() => parseCache(JSON.stringify({ version: 1, owner: 'b', base: empty(), pending: [], legacyImported: true }), 'a'));
  assert.throws(() => parseCache(JSON.stringify({ version: 1, owner: 'a', base: {}, pending: [], legacyImported: true }), 'a'));
});
test('logging out during a request retains old-account pending changes and ignores late responses', async () => {
  const storage = memory(); const remote = server(); const store = new SyncStore('a', storage, remote); await store.start();
  let release; let received; const started = new Promise((resolve) => { received = resolve; });
  remote.sync = async () => { received(); return new Promise((resolve) => { release = resolve; }); };
  const t = task(); store.enqueue(mutation(t)); await started; store.stop(); release({ tasks: [t], habits: [] }); await tick();
  assert.equal(parseCache(storage.values.get(cacheKey('a')), 'a').pending.length, 1);
  const b = new SyncStore('b', storage, server()); await b.start(); assert.equal(b.getSnapshot().tasks.length, 0); b.stop();
});
test('a failed local save is retried before sending any mutation to the server', async () => {
  const storage = memory(); const remote = server(); const store = new SyncStore('a', storage, remote); await store.start();
  const write = storage.setItem; storage.setItem = async () => { throw new Error('Disk full'); };
  const t = task(); store.enqueue(mutation(t)); await drain(store); assert.equal(remote.data.tasks.length, 0);
  storage.setItem = write; await drain(store); assert.equal(remote.data.tasks.length, 1); assert.equal(store.getSnapshot().pending, 0); store.stop();
});

test('an interrupted guest move stays bound to its account and recovers without data loss', async () => {
  const t = task(); const storage = memory({ 'tareas.tasks.v1': JSON.stringify([t]) });
  const write = storage.setItem; let fail = true;
  storage.setItem = async (key, value) => {
    if (fail && key === cacheKey(null)) { fail = false; throw new Error('Interrupted'); }
    return write(key, value);
  };
  const interrupted = new SyncStore('a', storage, server()); await interrupted.start();
  assert.equal(interrupted.getSnapshot().ready, false); interrupted.stop();
  const other = new SyncStore('b', storage, server()); await other.start(); assert.equal(other.getSnapshot().tasks.length, 0); other.stop();
  const guest = new SyncStore(null, storage, null); await guest.start(); assert.equal(guest.getSnapshot().tasks.length, 0); guest.stop();
  const remote = server(); const restored = new SyncStore('a', storage, remote); await restored.start();
  assert.equal(remote.data.tasks[0].id, t.id); assert.equal(restored.getSnapshot().tasks.length, 1);
  assert.equal(storage.values.get('tareas.tasks.v1'), JSON.stringify([t])); restored.stop();
});

test('a lost acknowledgement keeps the outbox and retries the same mutation ids', async () => {
  const storage = memory(); const remote = server(); const store = new SyncStore('a', storage, remote); await store.start();
  const apply = remote.sync; let loseResponse = true;
  remote.sync = async (ops) => { const result = await apply(ops); if (loseResponse) throw new Error('Response lost'); return result; };
  const t = task(); store.enqueue(mutation(t)); await drain(store);
  assert.equal(remote.data.tasks.length, 1); assert.equal(store.getSnapshot().pending, 1);
  loseResponse = false; await drain(store);
  assert.equal(remote.data.tasks.length, 1); assert.equal(store.getSnapshot().pending, 0); store.stop();
});

test('lists and task moves survive offline restart and sync before guest tasks', async () => {
  const storage = memory();
  const guest = new SyncStore(null, storage, null); await guest.start();
  const list = createTaskList('Trabajo'); const t = createTask({ title: 'Informe', description: '', dueAt: null, hasTime: false, listId: list.id });
  guest.enqueue(mutation(list, 'lists', 'list-create')); guest.enqueue(mutation(t)); await drain(guest); guest.stop();
  const restored = new SyncStore(null, storage, null); await restored.start();
  assert.equal(restored.getSnapshot().lists[0].name, 'Trabajo'); assert.equal(restored.getSnapshot().tasks[0].listId, list.id); restored.stop();
  const remote = server(); const applied = []; const sync = remote.sync;
  remote.sync = async (ops) => { applied.push(...ops.map((op) => op.entity)); return sync(ops); };
  const account = new SyncStore('a', storage, remote); await account.start();
  assert.deepEqual(applied.slice(0, 2), ['lists', 'tasks']); assert.equal(remote.data.tasks[0].listId, list.id);
  account.enqueue({ entity: 'tasks', action: 'patch', id: t.id, mutationId: 'move', patch: { listId: null } }); await drain(account);
  assert.equal(remote.data.tasks[0].listId, null); account.stop();
  const other = new SyncStore('b', storage, server()); await other.start(); assert.equal(other.getSnapshot().lists.length, 0); other.stop();
});

test('list wire fields and default assignments preserve ownership and legacy records', () => {
  const list = createTaskList('Compras');
  const encoded = encodeMutation(mutation(list, 'lists'));
  assert.equal(encoded.entidad, 'listas'); assert.equal(encoded.campos.nombre, 'Compras');
  const records = decodeRecords({ tareas: [], habitos: [], listas: [{ id: list.id, usuario_id: 'a', nombre: list.name, creada_en: list.createdAt }] }, 'a');
  assert.deepEqual(records.lists, [list]);
  assert.throws(() => decodeRecords({ tareas: [], habitos: [], listas: [{ id: list.id, usuario_id: 'b', nombre: list.name, creada_en: list.createdAt }] }, 'a'));
  const legacy = { ...task() }; delete legacy.listId;
  const cache = parseCache(JSON.stringify({ version: 1, owner: null, base: { tasks: [legacy], habits: [] }, pending: [], legacyImported: true }), null);
  assert.equal(cache.base.tasks[0].listId, null); assert.deepEqual(cache.base.lists, []);
  const pendingCache = parseCache(JSON.stringify({ version: 1, owner: 'a', base: empty(), pending: [mutation(legacy)], legacyImported: true }), 'a');
  assert.equal(projectRecords(pendingCache.base, pendingCache.pending).tasks[0].listId, null);
});

test('recovers a list misfiled as a habit by a pre-update live store without losing real habits', async () => {
  const list = createTaskList('Trabajo'); const h = habit('Caminar', 2);
  const t = task();
  const raw = JSON.stringify({ version: 1, owner: null, base: { tasks: [t], habits: [h, list] }, pending: [], legacyImported: true });
  const storage = memory({ [cacheKey(null)]: raw });
  const store = new SyncStore(null, storage, null); await store.start();
  assert.equal(store.getSnapshot().ready, true);
  assert.deepEqual(store.getSnapshot().habits, [h]); assert.deepEqual(store.getSnapshot().lists, [list]);
  assert.deepEqual(store.getSnapshot().tasks, [t]);
  assert.deepEqual(JSON.parse(storage.values.get(cacheKey(null))).base.habits, [h]); store.stop();
  assert.throws(() => parseCache(JSON.stringify({ version: 1, owner: null, base: { tasks: [], habits: [{ id: 'list-invalid', name: 'Invalid' }] }, pending: [], legacyImported: true }), null));
});

test('list rename and deletion persist offline and preserve all task fields', async () => {
  const list = createTaskList('Trabajo');
  const assigned = { ...task(), listId: list.id, starred: true, completed: true };
  const other = task();
  const base = { tasks: [assigned, other], habits: [], lists: [list] };
  const storage = memory({ [cacheKey('owner')]: JSON.stringify({ version: 1, owner: 'owner', base, pending: [], legacyImported: true }) });
  const remote = server(); remote.data = base; remote.setOnline(false);
  const store = new SyncStore('owner', storage, remote); await store.start();
  store.enqueue({ entity: 'lists', id: list.id, action: 'patch', patch: { name: 'Personal' }, mutationId: 'rename-list' });
  await tick();
  assert.equal(store.getSnapshot().lists[0].name, 'Personal');
  assert.equal(encodeMutation({ entity: 'lists', id: list.id, action: 'patch', patch: { name: 'Personal' }, mutationId: 'rename-list' }).campos.nombre, 'Personal');
  store.enqueue({ entity: 'lists', id: list.id, action: 'delete', mutationId: 'delete-list' }); await tick();
  assert.deepEqual(store.getSnapshot().tasks, [{ ...assigned, listId: null }, other]);
  store.stop();
  const restarted = new SyncStore('owner', storage, remote); await restarted.start();
  assert.equal(restarted.getSnapshot().lists.length, 0);
  remote.setOnline(true); await restarted.synchronize();
  assert.deepEqual(remote.data.tasks, [{ ...assigned, listId: null }, other]);
  assert.equal(remote.data.lists.length, 0); restarted.stop();
});
