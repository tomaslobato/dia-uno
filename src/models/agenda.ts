import { compareTaskDueDate, type Task } from './task.ts';
import { dayKey, localDay, isScheduledDay, type Habit } from './habit.ts';

export function calendarMonthDays(month: Date): string[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const offset = (first.getDay() + 6) % 7;
  const count = Math.ceil((offset + last.getDate()) / 7) * 7;
  const weeks: string[][] = [];
  for (let i = 0; i < count; i++) {
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push(dayKey(new Date(first.getFullYear(), first.getMonth(), 1 - offset + i, 12)));
  }
  return weeks;
}
export function taskAgendaDay(task: Task): string | null {
  return task.dueAt ? dayKey(new Date(task.dueAt)) : null;
}
export function isAgendaTaskOverdue(task: Task, now = new Date()): boolean {
  if (task.completed || !task.dueAt) return false;
  const due = new Date(task.dueAt);
  if (!task.hasTime) due.setHours(23, 59, 59, 999);
  return due.getTime() < now.getTime();
}
export function agendaTasksForDay(tasks: Task[], day: string, includeOverdue = false, now = new Date()): Task[] {
  return tasks.filter((task) => taskAgendaDay(task) === day || (includeOverdue && day === dayKey(now) && isAgendaTaskOverdue(task, now))).sort(compareTaskDueDate);
}
export function overdueAgendaDays(tasks: Task[], now = new Date()): Set<string> {
  const days = new Set<string>();
  const today = dayKey(now);
  for (const task of tasks) {
    if (task.completed || !task.dueAt) continue;
    const due = new Date(task.dueAt);
    if (!task.hasTime) due.setHours(23, 59, 59, 999);
    if (due.getTime() < now.getTime()) { days.add(taskAgendaDay(task)!); days.add(today); }
  }
  return days;
}
export function validAgendaDay(day: unknown): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = localDay(day);
  return Number.isFinite(date.getTime()) && dayKey(date) === day;
}
export function agendaDayTitle(day: string, now = new Date()): string {
  if (day === dayKey(now)) return 'Tareas de hoy';
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (day === dayKey(tomorrow)) return 'Tareas de mañana';
  return `Tareas del ${localDay(day).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export function calendarWeekDays(anchor: Date): string[] {
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12)));
}
export function agendaWeekTitle(days: string[], includeYear = true): string {
  const start = localDay(days[0]);
  const end = localDay(days[days.length - 1]);
  if (!includeYear) {
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) return `${start.getDate()}-${end.toLocaleDateString('es', { day: 'numeric', month: 'long' })}`;
    return `${start.toLocaleDateString('es', { day: 'numeric', month: 'long' })}-${end.toLocaleDateString('es', { day: 'numeric', month: 'long' })}`;
  }
  if (start.getFullYear() !== end.getFullYear()) return `${start.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  if (start.getMonth() !== end.getMonth()) return `${start.toLocaleDateString('es', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `${start.getDate()} – ${end.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export function calendarRangeDays(anchor: Date, count: 2 | 3 | 4): string[] {
  return Array.from({ length: count }, (_, i) => dayKey(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i, 12)));
}

export function compareAgendaTasks(a: Task, b: Task, prioritizeStars = false): number {
  if (prioritizeStars && a.starred !== b.starred) return a.starred ? -1 : 1;
  return compareTaskDueDate(a, b);
}

export function agendaHabitsForDay(habits: Habit[], day: string, today = dayKey()): Habit[] {
  if (day > today) return [];
  return habits.filter((habit) => isScheduledDay(habit, day) || habit.completedDays.includes(day));
}

export function shiftAgendaDay(day: string, offset: number): string {
  const date = localDay(day);
  date.setDate(date.getDate() + offset);
  return dayKey(date);
}
export function agendaDayLabel(day: string, now = new Date()): string {
  const today = dayKey(now);
  if (day === today) return 'Hoy';
  if (day === shiftAgendaDay(today, -1)) return 'Ayer';
  if (day === shiftAgendaDay(today, 1)) return 'Mañana';
  const label = localDay(day).toLocaleDateString('es', { weekday: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
