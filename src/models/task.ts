import { normalizeTaskListId } from './task-list.ts';
export type TaskRepeatUnit = 'days' | 'weeks' | 'months';
export type Task = {
  id: string;
  title: string;
  description: string;
  dueAt: string | null;
  hasTime: boolean;
  completed: boolean;
  starred: boolean;
  createdAt: string;
  listId: string | null;
  repeatEvery: number | null;
  repeatUnit: TaskRepeatUnit | null;
  recurrenceId: string | null;
  reminderMinutes: number | null;
};

export type TaskDraft = Pick<Task, 'title' | 'description' | 'dueAt' | 'hasTime'> & { listId?: string | null; repeatEvery?: number | null; repeatUnit?: TaskRepeatUnit | null; recurrenceId?: string | null; reminderMinutes?: number | null };

export function createTask(draft: TaskDraft, now = new Date()): Task {
  const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
  const repeatEvery = draft.repeatEvery ?? null;
  const repeatUnit = repeatEvery === null ? null : draft.repeatUnit ?? 'days';
  return {
    ...draft,
    listId: normalizeTaskListId(draft.listId),
    title: draft.title.trim(),
    description: draft.description.trim(),
    id,
    completed: false,
    starred: false,
    createdAt: now.toISOString(),
    repeatEvery,
    repeatUnit,
    recurrenceId: repeatEvery === null ? null : draft.recurrenceId ?? id,
    reminderMinutes: draft.reminderMinutes === undefined ? 30 : draft.reminderMinutes,
  };
}

export function nextRecurringDueAt(task: Task, now = new Date(), anchorDueAt?: string | null): string | null {
  if (!task.dueAt || !task.repeatEvery || !task.repeatUnit) return null;
  const due = new Date(task.dueAt);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anchorDay = new Date(anchorDueAt ?? task.dueAt).getDate();
  const add = () => {
    if (task.repeatUnit === 'days') dueDay.setDate(dueDay.getDate() + task.repeatEvery!);
    else if (task.repeatUnit === 'weeks') dueDay.setDate(dueDay.getDate() + task.repeatEvery! * 7);
    else if (task.repeatUnit === 'months') {
      dueDay.setDate(1);
      dueDay.setMonth(dueDay.getMonth() + task.repeatEvery!);
      dueDay.setDate(Math.min(anchorDay, new Date(dueDay.getFullYear(), dueDay.getMonth() + 1, 0).getDate()));
    }
  };
  do { add(); } while (dueDay <= today);
  dueDay.setHours(due.getHours(), due.getMinutes(), due.getSeconds(), due.getMilliseconds());
  return dueDay.toISOString();
}

export function getTaskReminderAt(task: Task): number | null {
  if (!task.dueAt || task.reminderMinutes === null) return null;
  const due = new Date(task.dueAt);
  if (!task.hasTime) due.setHours(9, 0, 0, 0);
  return due.getTime() - task.reminderMinutes * 60_000;
}

export function parseTasks(value: string | null): Task[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(isTask)) throw new Error('Invalid task storage');
  return parsed.map((task: Task) => {
    const legacyRecurrence = (task as Task & { recurrence?: string }).recurrence;
    const repeatEvery = task.repeatEvery ?? (legacyRecurrence === 'daily' || legacyRecurrence === 'weekly' || legacyRecurrence === 'monthly' ? 1 : legacyRecurrence === 'yearly' ? 12 : null);
    const repeatUnit = task.repeatUnit ?? (legacyRecurrence === 'weekly' ? 'weeks' : legacyRecurrence === 'monthly' || legacyRecurrence === 'yearly' ? 'months' : repeatEvery ? 'days' : null);
    const { recurrence: _legacy, ...current } = task as Task & { recurrence?: string };
    return { ...current, starred: task.starred ?? false, listId: normalizeTaskListId(task.listId), repeatEvery, repeatUnit,
      recurrenceId: task.recurrenceId ?? (repeatEvery === null ? null : task.id), reminderMinutes: task.reminderMinutes === undefined ? 30 : task.reminderMinutes };
  });
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<Task>;
  return (
    typeof task.id === 'string' && typeof task.title === 'string' && task.title.trim().length > 0 &&
    typeof task.description === 'string' && typeof task.completed === 'boolean' &&
    (task.starred === undefined || typeof task.starred === 'boolean') &&
    (task.listId === undefined || task.listId === null || (typeof task.listId === 'string' && task.listId.length > 0)) &&
    typeof task.hasTime === 'boolean' && typeof task.createdAt === 'string' &&
    (task.repeatEvery === undefined || task.repeatEvery === null || (typeof task.repeatEvery === 'number' && Number.isInteger(task.repeatEvery) && task.repeatEvery >= 1 && task.repeatEvery <= 10000)) &&
    (task.repeatUnit === undefined || task.repeatUnit === null || ['days', 'weeks', 'months'].includes(task.repeatUnit)) &&
    (task.recurrenceId === undefined || task.recurrenceId === null || typeof task.recurrenceId === 'string') &&
    (task.reminderMinutes === undefined || task.reminderMinutes === null || (typeof task.reminderMinutes === 'number' && Number.isInteger(task.reminderMinutes) && task.reminderMinutes >= 1 && task.reminderMinutes <= 10080)) &&
    (task.dueAt === null || (typeof task.dueAt === 'string' && Number.isFinite(Date.parse(task.dueAt))))
  );
}

export function formatDueDate(dueAt: string, hasTime: boolean, today = new Date()): string {
  const date = new Date(dueAt);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  let label = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  if (date.getFullYear() !== today.getFullYear()) {
    label = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  // Count calendar days, not elapsed hours: yesterday can be 23 or 25 hours long.
  const ordinal = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000;
  const daysAgo = ordinal(today) - ordinal(date);
  if (daysAgo === 1) label = 'Ayer';
  else if (daysAgo > 1) label = `Hace ${daysAgo} días`;
  if (daysAgo === 0) label = 'Hoy';
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

export function taskDateSection(task: Task, now = new Date()): string {
  if (!task.dueAt) return 'Sin fecha';
  const due = new Date(task.dueAt);
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = (day(due) - day(now)) / 86400000;
  if (difference < 0) return 'Vencidas';
  if (difference === 0) return 'Hoy';
  if (difference === 1) return 'Mañana';
  const daysUntilMonday = 7 - (now.getDay() + 6) % 7;
  return difference < daysUntilMonday ? 'Esta semana' : 'Futuro';
}

// Today's scheduled tasks stay together until the local calendar day ends.
export function staysInTaskSchedule(task: Task, now = new Date()): boolean {
  return !task.completed || matchesTaskDate(task, 'today', now);
}
