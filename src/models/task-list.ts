export type TaskList = { id: string; name: string; createdAt: string };
export const DEFAULT_LIST_ID = 'mis-tareas';
export function normalizeTaskListId(id?: string | null): string | null { return !id || id === DEFAULT_LIST_ID ? null : id; }
export function createTaskList(name: string, now = new Date()): TaskList {
  return { id: `list-${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`, name: name.trim(), createdAt: now.toISOString() };
}
export function parseTaskLists(value: unknown): TaskList[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((list) => list && typeof list.id === 'string' && list.id && typeof list.name === 'string' && list.name.trim().length > 0 && list.name.length <= 120 && typeof list.createdAt === 'string' && Number.isFinite(Date.parse(list.createdAt)))) throw new Error('Listas inválidas');
  return value;
}
