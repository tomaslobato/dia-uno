export type Task = {
  id: string;
  title: string;
  description: string;
  dueAt: string | null;
  hasTime: boolean;
  completed: boolean;
  starred: boolean;
  createdAt: string;
};

export type TaskDraft = Pick<Task, 'title' | 'description' | 'dueAt' | 'hasTime'>;

export function createTask(draft: TaskDraft, now = new Date()): Task {
  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    completed: false,
    starred: false,
    createdAt: now.toISOString(),
  };
}

export function parseTasks(value: string | null): Task[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(isTask)) throw new Error('Invalid task storage');
  return parsed.map((task: Task) => ({ ...task, starred: task.starred ?? false }));
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<Task>;
  return (
    typeof task.id === 'string' && typeof task.title === 'string' && task.title.trim().length > 0 &&
    typeof task.description === 'string' && typeof task.completed === 'boolean' &&
    (task.starred === undefined || typeof task.starred === 'boolean') &&
    typeof task.hasTime === 'boolean' && typeof task.createdAt === 'string' &&
    (task.dueAt === null || (typeof task.dueAt === 'string' && Number.isFinite(Date.parse(task.dueAt))))
  );
}

export function formatDueDate(dueAt: string, hasTime: boolean): string {
  const date = new Date(dueAt);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  let label = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  if (date.getFullYear() !== today.getFullYear()) {
    label = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (date.toDateString() === today.toDateString()) label = 'Hoy';
  if (date.toDateString() === tomorrow.toDateString()) label = 'Mañana';
  return hasTime
    ? `${label}, ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : label;
}

export function isOverdue(task: Task): boolean {
  if (!task.dueAt || task.completed) return false;
  const due = new Date(task.dueAt);
  if (!task.hasTime) due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

export function compareTaskDueDate(a: Task, b: Task): number {
  if (!a.dueAt) return b.dueAt ? 1 : 0;
  if (!b.dueAt) return -1;
  const timestamp = (task: Task): number => {
    const date = new Date(task.dueAt!);
    // Date-only tasks come first on their calendar day, ignoring hidden hours.
    if (!task.hasTime) date.setHours(0, 0, 0, 0);
    return date.getTime();
  };
  return timestamp(a) - timestamp(b);
}

export type TaskDateFilter = 'all' | 'today' | 'week';

export function matchesTaskDate(task: Task, filter: TaskDateFilter, now = new Date()): boolean {
  if (filter === 'all') return true;
  if (!task.dueAt) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (filter === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start);
  end.setDate(end.getDate() + (filter === 'week' ? 7 : 1));
  const due = new Date(task.dueAt).getTime();
  return due >= start.getTime() && due < end.getTime();
}
