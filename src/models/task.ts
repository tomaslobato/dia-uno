import { dayKey, localDay } from './habit.ts';
import { normalizeTaskListId } from './task-list.ts';
export type TaskRepeatUnit = 'days' | 'weeks' | 'months' | 'years';
/** Delete this occurrence, this and following, or the whole series (Google Calendar style). */
export type TaskDeleteScope = 'this' | 'future' | 'all';
/** JS `Date#getDay()` values: 0 = Sunday … 6 = Saturday. */
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
  repeatWeekdays: number[];
  /** Inclusive last day of the series (`YYYY-MM-DD`), or null for no end. */
  repeatEndsAt: string | null;
  /** Day keys where this series occurrence was completed. */
  completedOccurrences: string[];
  /** Day keys removed with “solo esta”. */
  excludedOccurrences: string[];
  recurrenceId: string | null;
  reminderMinutes: number | null;
};

export type TaskDraft = Pick<Task, 'title' | 'description' | 'dueAt' | 'hasTime'> & {
  listId?: string | null;
  starred?: boolean;
  repeatEvery?: number | null;
  repeatUnit?: TaskRepeatUnit | null;
  repeatWeekdays?: number[];
  repeatEndsAt?: string | null;
  recurrenceId?: string | null;
  reminderMinutes?: number | null;
};

function normalizeWeekdays(unit: TaskRepeatUnit | null, weekdays: number[] | undefined, dueAt: string | null): number[] {
  if (unit !== 'weeks') return [];
  const cleaned = [...new Set((weekdays ?? []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
  if (cleaned.length) return cleaned;
  if (dueAt) return [new Date(dueAt).getDay()];
  return [];
}

/** Monday-first index 0…6 for sorting weekdays in calendar order. */
function mondayIndex(day: number) {
  return (day + 6) % 7;
}

function sortWeekdays(weekdays: number[]) {
  return [...weekdays].sort((a, b) => mondayIndex(a) - mondayIndex(b));
}

function withDueTime(day: Date, timeSource: Date) {
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), timeSource.getHours(), timeSource.getMinutes(), timeSource.getSeconds(), timeSource.getMilliseconds());
  return next;
}

/** Move `date` forward to the next selected weekday (or keep it if already selected). */
export function alignDueToWeekdays(date: Date, weekdays: number[]): Date {
  const days = sortWeekdays(weekdays);
  if (!days.length || days.includes(date.getDay())) return new Date(date);
  for (let offset = 1; offset <= 7; offset++) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    if (days.includes(next.getDay())) return next;
  }
  return new Date(date);
}

function validDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dayKey(localDay(value)) === value;
}

function normalizeDayKeys(days: string[] | undefined): string[] {
  return [...new Set((days ?? []).filter(validDayKey))].sort();
}

function shiftDayKey(day: string, offset: number): string {
  const date = localDay(day);
  date.setDate(date.getDate() + offset);
  return dayKey(date);
}

function calendarDaysBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function isRecurringTask(task: Pick<Task, 'dueAt' | 'repeatEvery' | 'repeatUnit'>): boolean {
  return Boolean(task.dueAt && task.repeatEvery && task.repeatUnit);
}

/** Whether the single stored series has a visible occurrence on `day` (virtual, not cloned). */
export function taskOccursOnDay(task: Task, day: string): boolean {
  if (!task.dueAt || !validDayKey(day)) return false;
  if (task.excludedOccurrences.includes(day)) return false;
  const start = dayKey(new Date(task.dueAt));
  if (day < start) return false;
  if (task.repeatEndsAt && day > task.repeatEndsAt) return false;
  if (!isRecurringTask(task)) return day === start;

  const startDate = localDay(start);
  const date = localDay(day);
  const every = task.repeatEvery!;

  if (task.repeatUnit === 'days') {
    const diff = calendarDaysBetween(startDate, date);
    return diff >= 0 && diff % every === 0;
  }
  if (task.repeatUnit === 'weeks') {
    const weekdays = sortWeekdays(task.repeatWeekdays.length ? task.repeatWeekdays : [startDate.getDay()]);
    if (!weekdays.includes(date.getDay())) return false;
    const startMonday = new Date(startDate);
    startMonday.setDate(startDate.getDate() - mondayIndex(startDate.getDay()));
    const dayMonday = new Date(date);
    dayMonday.setDate(date.getDate() - mondayIndex(date.getDay()));
    const weeks = calendarDaysBetween(startMonday, dayMonday) / 7;
    return weeks >= 0 && weeks % every === 0;
  }
  if (task.repeatUnit === 'months') {
    const months = (date.getFullYear() - startDate.getFullYear()) * 12 + (date.getMonth() - startDate.getMonth());
    if (months < 0 || months % every !== 0) return false;
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === Math.min(startDate.getDate(), lastDay);
  }
  const years = date.getFullYear() - startDate.getFullYear();
  if (years < 0 || years % every !== 0) return false;
  if (date.getMonth() !== startDate.getMonth()) return false;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === Math.min(startDate.getDate(), lastDay);
}

export function occurrenceDueAt(task: Task, day: string): string {
  const base = task.dueAt ? new Date(task.dueAt) : localDay(day);
  const date = localDay(day);
  if (!task.hasTime) return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).toISOString();
  return withDueTime(date, base).toISOString();
}

export function isOccurrenceCompleted(task: Task, day: string): boolean {
  if (!isRecurringTask(task)) return task.completed;
  return task.completedOccurrences.includes(day);
}

/** Display copy of the series for one calendar day (same id, virtual due/completed). */
export function asOccurrence(task: Task, day: string): Task {
  return {
    ...task,
    dueAt: occurrenceDueAt(task, day),
    completed: isOccurrenceCompleted(task, day),
  };
}

/** Next day key on or after `fromDay` where the series appears. */
export function nextOccurrenceDay(task: Task, fromDay = dayKey(), inclusive = true): string | null {
  if (!task.dueAt) return null;
  let cursor = inclusive ? fromDay : shiftDayKey(fromDay, 1);
  const start = dayKey(new Date(task.dueAt));
  if (cursor < start) cursor = start;
  for (let guard = 0; guard < 4000; guard++) {
    if (task.repeatEndsAt && cursor > task.repeatEndsAt) return null;
    if (taskOccursOnDay(task, cursor)) return cursor;
    if (!isRecurringTask(task)) return null;
    cursor = shiftDayKey(cursor, 1);
  }
  return null;
}

/** Day used for list rows: today if it occurs, otherwise the next upcoming occurrence. */
export function activeOccurrenceDay(task: Task, now = new Date()): string | null {
  if (!task.dueAt) return null;
  const today = dayKey(now);
  if (taskOccursOnDay(task, today)) return today;
  return nextOccurrenceDay(task, today, true);
}

export function withOccurrenceToggle(task: Task, day: string): Partial<Task> {
  if (!isRecurringTask(task)) return { completed: !task.completed };
  const done = task.completedOccurrences.includes(day);
  return {
    completedOccurrences: done
      ? task.completedOccurrences.filter((key) => key !== day)
      : [...task.completedOccurrences, day].sort(),
  };
}

export function withOccurrenceDelete(
  task: Task,
  day: string,
  scope: TaskDeleteScope,
): { action: 'delete' } | { action: 'patch'; patch: Partial<Task> } {
  if (!isRecurringTask(task) || scope === 'all') return { action: 'delete' };
  if (scope === 'this') {
    return {
      action: 'patch',
      patch: {
        excludedOccurrences: [...new Set([...task.excludedOccurrences, day])].sort(),
        completedOccurrences: task.completedOccurrences.filter((key) => key !== day),
      },
    };
  }
  const end = shiftDayKey(day, -1);
  const start = dayKey(new Date(task.dueAt!));
  if (end < start) return { action: 'delete' };
  return {
    action: 'patch',
    patch: {
      repeatEndsAt: end,
      completedOccurrences: task.completedOccurrences.filter((key) => key <= end),
      excludedOccurrences: task.excludedOccurrences.filter((key) => key <= end),
    },
  };
}

export function createTask(draft: TaskDraft, now = new Date(), id = `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`): Task {
  const repeatEvery = draft.repeatEvery ?? null;
  const repeatUnit = repeatEvery === null ? null : draft.repeatUnit ?? 'days';
  const dueAt = draft.dueAt ?? null;
  const repeatWeekdays = normalizeWeekdays(repeatUnit, draft.repeatWeekdays, dueAt);
  const repeatEndsAt = repeatEvery && draft.repeatEndsAt && validDayKey(draft.repeatEndsAt) ? draft.repeatEndsAt : null;
  return {
    listId: normalizeTaskListId(draft.listId),
    title: draft.title.trim(),
    description: draft.description.trim(),
    dueAt,
    hasTime: draft.hasTime,
    id,
    completed: false,
    starred: draft.starred ?? false,
    createdAt: now.toISOString(),
    repeatEvery,
    repeatUnit,
    repeatWeekdays,
    repeatEndsAt,
    completedOccurrences: [],
    excludedOccurrences: [],
    recurrenceId: repeatEvery === null ? null : draft.recurrenceId ?? id,
    reminderMinutes: draft.reminderMinutes === undefined ? 30 : draft.reminderMinutes,
  };
}

/** @deprecated Prefer nextOccurrenceDay + occurrenceDueAt for virtual series. */
export function nextRecurringDueAt(task: Task, now = new Date()): string | null {
  const day = nextOccurrenceDay(task, dayKey(now), false);
  return day ? occurrenceDueAt(task, day) : null;
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
    const dueAt = current.dueAt ?? null;
    const repeatEndsAt = current.repeatEndsAt && validDayKey(current.repeatEndsAt) ? current.repeatEndsAt : null;
    return {
      ...current,
      starred: task.starred ?? false,
      listId: normalizeTaskListId(task.listId),
      repeatEvery,
      repeatUnit,
      repeatWeekdays: normalizeWeekdays(repeatUnit, task.repeatWeekdays, dueAt),
      repeatEndsAt: repeatEvery ? repeatEndsAt : null,
      completedOccurrences: normalizeDayKeys(task.completedOccurrences),
      excludedOccurrences: normalizeDayKeys(task.excludedOccurrences),
      recurrenceId: task.recurrenceId ?? (repeatEvery === null ? null : task.id),
      reminderMinutes: task.reminderMinutes === undefined ? 30 : task.reminderMinutes,
    };
  });
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<Task>;
  const dayListOk = (value: unknown) => value === undefined || (Array.isArray(value) && value.every((day) => typeof day === 'string'));
  return (
    typeof task.id === 'string' && typeof task.title === 'string' && task.title.trim().length > 0 &&
    typeof task.description === 'string' && typeof task.completed === 'boolean' &&
    (task.starred === undefined || typeof task.starred === 'boolean') &&
    (task.listId === undefined || task.listId === null || (typeof task.listId === 'string' && task.listId.length > 0)) &&
    typeof task.hasTime === 'boolean' && typeof task.createdAt === 'string' &&
    (task.repeatEvery === undefined || task.repeatEvery === null || (typeof task.repeatEvery === 'number' && Number.isInteger(task.repeatEvery) && task.repeatEvery >= 1 && task.repeatEvery <= 10000)) &&
    (task.repeatUnit === undefined || task.repeatUnit === null || ['days', 'weeks', 'months', 'years'].includes(task.repeatUnit)) &&
    (task.repeatWeekdays === undefined || (Array.isArray(task.repeatWeekdays) && task.repeatWeekdays.every((day) => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6))) &&
    (task.repeatEndsAt === undefined || task.repeatEndsAt === null || typeof task.repeatEndsAt === 'string') &&
    dayListOk(task.completedOccurrences) && dayListOk(task.excludedOccurrences) &&
    (task.recurrenceId === undefined || task.recurrenceId === null || typeof task.recurrenceId === 'string') &&
    (task.reminderMinutes === undefined || task.reminderMinutes === null || (typeof task.reminderMinutes === 'number' && Number.isInteger(task.reminderMinutes) && task.reminderMinutes >= 1 && task.reminderMinutes <= 10080)) &&
    (task.dueAt === null || (typeof task.dueAt === 'string' && Number.isFinite(Date.parse(task.dueAt))))
  );
}

/** Human-readable recurrence for agenda/detail surfaces, e.g. "Todos los martes". */
export function formatTaskRepeat(task: Pick<Task, 'repeatEvery' | 'repeatUnit' | 'dueAt' | 'repeatWeekdays'>): string | null {
  if (!task.repeatEvery || !task.repeatUnit) return null;
  const every = task.repeatEvery;
  if (task.repeatUnit === 'days') {
    return every === 1 ? 'Todos los días' : `Cada ${every} días`;
  }
  if (task.repeatUnit === 'weeks') {
    const labels = sortWeekdays(task.repeatWeekdays ?? []).map((day) => {
      // 12 Oct 2026 is a Monday; offset by Monday-first index.
      const sample = new Date(2026, 9, 12 + mondayIndex(day), 12);
      return sample.toLocaleDateString('es', { weekday: 'long' });
    });
    if (labels.length > 1) {
      const list = labels.length === 2
        ? `${labels[0]} y ${labels[1]}`
        : `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
      return every === 1 ? `Todos los ${list}` : `Cada ${every} semanas los ${list}`;
    }
    const weekday = labels[0] ?? (task.dueAt ? new Date(task.dueAt).toLocaleDateString('es', { weekday: 'long' }) : null);
    if (every === 1) return weekday ? `Todos los ${weekday}` : 'Todas las semanas';
    return weekday ? `Cada ${every} semanas los ${weekday}` : `Cada ${every} semanas`;
  }
  if (task.repeatUnit === 'months') {
    return every === 1 ? 'Todos los meses' : `Cada ${every} meses`;
  }
  return every === 1 ? 'Todos los años' : `Cada ${every} años`;
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

export function isOverdue(task: Task, now = new Date()): boolean {
  let dueAt = task.dueAt;
  let completed = task.completed;
  if (isRecurringTask(task)) {
    const day = activeOccurrenceDay(task, now);
    if (!day) return false;
    completed = isOccurrenceCompleted(task, day);
    dueAt = occurrenceDueAt(task, day);
  }
  if (!dueAt || completed) return false;
  const due = new Date(dueAt);
  if (!task.hasTime) due.setHours(23, 59, 59, 999);
  return due.getTime() < now.getTime();
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

export function sortTasksByOrder(tasks: Task[], order: string[]): Task[] {
  const index = new Map(order.map((id, position) => [id, position]));
  return [...tasks].sort((a, b) => {
    const left = index.has(a.id) ? index.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const right = index.has(b.id) ? index.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (left !== right) return left - right;
    return compareTaskDueDate(a, b) || a.id.localeCompare(b.id);
  });
}

export function mergeOrderWithTasks(order: string[], tasks: Task[]): string[] {
  const present = new Set(tasks.map((task) => task.id));
  const kept = order.filter((id) => present.has(id));
  const missing = tasks.filter((task) => !kept.includes(task.id)).sort(compareTaskDueDate).map((task) => task.id);
  return [...kept, ...missing];
}

export type TaskDateFilter = 'all' | 'today' | 'week';

export function matchesTaskDate(task: Task, filter: TaskDateFilter, now = new Date()): boolean {
  if (filter === 'all') return true;
  if (!task.dueAt) return false;
  if (filter === 'today') return taskOccursOnDay(task, dayKey(now));
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  for (let offset = 0; offset < 7; offset++) {
    const day = dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, 12));
    if (taskOccursOnDay(task, day)) return true;
  }
  return false;
}

function calendarDayDiff(due: Date, now: Date) {
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  return day(due) - day(now);
}

export function taskDateSection(task: Task, now = new Date()): string {
  const day = isRecurringTask(task) ? activeOccurrenceDay(task, now) : task.dueAt ? dayKey(new Date(task.dueAt)) : null;
  if (!day) return 'Sin fecha';
  const due = localDay(day);
  const difference = calendarDayDiff(due, now);
  // Overdue tasks stay under Hoy so the list always starts from today.
  if (difference <= 0) return 'Hoy';
  if (difference === 1) return 'Mañana';
  const label = due.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(due.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatTaskDueInSection(task: Task, now = new Date()): { label: string | null; time: string | null; emphasize: boolean } {
  if (!task.dueAt) return { label: null, time: null, emphasize: false };
  const due = new Date(task.dueAt);
  const time = task.hasTime ? due.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
  const difference = calendarDayDiff(due, now);
  const emphasize = isOverdue(task, now);
  if (difference < 0) {
    const label = difference === -1
      ? 'Ayer'
      : due.toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'short',
          ...(due.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
        });
    return { label, time, emphasize: true };
  }
  // Same calendar day (including overdue-by-time): only the hour, highlighted when late.
  return { label: null, time, emphasize };
}

// Today's scheduled tasks stay together until the local calendar day ends.
export function staysInTaskSchedule(task: Task, now = new Date()): boolean {
  if (isRecurringTask(task)) {
    const day = activeOccurrenceDay(task, now);
    if (!day) return false;
    return !isOccurrenceCompleted(task, day) || day === dayKey(now);
  }
  return !task.completed || matchesTaskDate(task, 'today', now);
}
