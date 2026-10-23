import { dayKey } from './habit.ts';
import { normalizeTaskListId } from './task-list.ts';
export type TaskRepeatUnit = 'days' | 'weeks' | 'months' | 'years';
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
  recurrenceId: string | null;
  reminderMinutes: number | null;
};

export type TaskDraft = Pick<Task, 'title' | 'description' | 'dueAt' | 'hasTime'> & {
  listId?: string | null;
  starred?: boolean;
  repeatEvery?: number | null;
  repeatUnit?: TaskRepeatUnit | null;
  repeatWeekdays?: number[];
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

/**
 * Extra due dates to create with a new recurring task so the current week is visible
 * in the agenda (e.g. Lun/Mié/Vie → mié+vie; Todos los días → resto de la semana).
 */
export function materializeSiblingDueAts(task: Task): string[] {
  if (!task.dueAt || !task.repeatEvery || !task.repeatUnit) return [];
  const due = new Date(task.dueAt);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const dueKey = dayKey(dueDay);
  const startMondayIdx = mondayIndex(dueDay.getDay());

  if (task.repeatUnit === 'weeks') {
    const weekdays = sortWeekdays(task.repeatWeekdays);
    if (weekdays.length < 2) return [];
    const monday = new Date(dueDay);
    monday.setDate(dueDay.getDate() - startMondayIdx);
    return weekdays.flatMap((weekday) => {
      const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + mondayIndex(weekday), 12);
      if (dayKey(day) <= dueKey) return [];
      return [withDueTime(day, due).toISOString()];
    });
  }

  if (task.repeatUnit === 'days') {
    const result: string[] = [];
    // Fill through Sunday of the same week on the chosen interval.
    for (let offset = task.repeatEvery; startMondayIdx + offset <= 6; offset += task.repeatEvery) {
      const day = new Date(dueDay.getFullYear(), dueDay.getMonth(), dueDay.getDate() + offset, 12);
      result.push(withDueTime(day, due).toISOString());
    }
    return result;
  }

  return [];
}

/** @deprecated Use materializeSiblingDueAts */
export function sameWeekSiblingDueAts(task: Task): string[] {
  return materializeSiblingDueAts(task);
}

export function createTask(draft: TaskDraft, now = new Date(), id = `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`): Task {
  const repeatEvery = draft.repeatEvery ?? null;
  const repeatUnit = repeatEvery === null ? null : draft.repeatUnit ?? 'days';
  const dueAt = draft.dueAt ?? null;
  const repeatWeekdays = normalizeWeekdays(repeatUnit, draft.repeatWeekdays, dueAt);
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
  const weekdays = sortWeekdays(task.repeatWeekdays);

  if (task.repeatUnit === 'weeks' && weekdays.length > 0) {
    let cursor = new Date(dueDay);
    for (let guard = 0; guard < 400; guard++) {
      const currentIdx = mondayIndex(cursor.getDay());
      const laterSameWeek = weekdays.find((day) => mondayIndex(day) > currentIdx);
      if (laterSameWeek !== undefined) {
        cursor.setDate(cursor.getDate() + (mondayIndex(laterSameWeek) - currentIdx));
      } else {
        const monday = new Date(cursor);
        monday.setDate(cursor.getDate() - currentIdx);
        monday.setDate(monday.getDate() + task.repeatEvery! * 7 + mondayIndex(weekdays[0]));
        cursor = monday;
      }
      if (cursor > today) {
        return withDueTime(cursor, due).toISOString();
      }
    }
    return null;
  }

  const add = () => {
    if (task.repeatUnit === 'days') dueDay.setDate(dueDay.getDate() + task.repeatEvery!);
    else if (task.repeatUnit === 'weeks') dueDay.setDate(dueDay.getDate() + task.repeatEvery! * 7);
    else if (task.repeatUnit === 'months') {
      dueDay.setDate(1);
      dueDay.setMonth(dueDay.getMonth() + task.repeatEvery!);
      dueDay.setDate(Math.min(anchorDay, new Date(dueDay.getFullYear(), dueDay.getMonth() + 1, 0).getDate()));
    } else if (task.repeatUnit === 'years') {
      dueDay.setDate(1);
      dueDay.setFullYear(dueDay.getFullYear() + task.repeatEvery!);
      dueDay.setMonth(due.getMonth());
      dueDay.setDate(Math.min(anchorDay, new Date(dueDay.getFullYear(), dueDay.getMonth() + 1, 0).getDate()));
    }
  };
  do { add(); } while (dueDay <= today);
  return withDueTime(dueDay, due).toISOString();
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
    return {
      ...current,
      starred: task.starred ?? false,
      listId: normalizeTaskListId(task.listId),
      repeatEvery,
      repeatUnit,
      repeatWeekdays: normalizeWeekdays(repeatUnit, task.repeatWeekdays, dueAt),
      recurrenceId: task.recurrenceId ?? (repeatEvery === null ? null : task.id),
      reminderMinutes: task.reminderMinutes === undefined ? 30 : task.reminderMinutes,
    };
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
    (task.repeatUnit === undefined || task.repeatUnit === null || ['days', 'weeks', 'months', 'years'].includes(task.repeatUnit)) &&
    (task.repeatWeekdays === undefined || (Array.isArray(task.repeatWeekdays) && task.repeatWeekdays.every((day) => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6))) &&
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
  if (!task.dueAt || task.completed) return false;
  const due = new Date(task.dueAt);
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
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (filter === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start);
  end.setDate(end.getDate() + (filter === 'week' ? 7 : 1));
  const due = new Date(task.dueAt).getTime();
  return due >= start.getTime() && due < end.getTime();
}

function calendarDayDiff(due: Date, now: Date) {
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  return day(due) - day(now);
}

export function taskDateSection(task: Task, now = new Date()): string {
  if (!task.dueAt) return 'Sin fecha';
  const due = new Date(task.dueAt);
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
  return !task.completed || matchesTaskDate(task, 'today', now);
}
