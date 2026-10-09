export type Habit = {
  id: string;
  name: string;
  intervalDays: number;
  createdOn: string;
  completedDays: string[];
};

export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function previousDay(today = new Date()): string {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return dayKey(yesterday);
}

function validDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dayKey(localDay(value)) === value;
}

export function createHabit(name: string, intervalDays: Habit['intervalDays'], now = new Date()): Habit {
  return { id: `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`, name: name.trim(), intervalDays, createdOn: dayKey(now), completedDays: [] };
}

export function parseHabits(value: string | null): Habit[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((habit: unknown) => {
    if (!habit || typeof habit !== 'object') return false;
    const h = habit as Partial<Habit>;
    return typeof h.id === 'string' && typeof h.name === 'string' && Boolean(h.name.trim()) &&
      Number.isSafeInteger(h.intervalDays) && (h.intervalDays as number) >= 1 && validDay(h.createdOn) &&
      Array.isArray(h.completedDays) && h.completedDays.every(validDay);
  })) throw new Error('Invalid habit storage');
  return parsed;
}

export function toggleHabitDay(habit: Habit, key: string, today = dayKey()): Habit {
  if (!validDay(key) || key > today) return habit;
  return { ...habit, completedDays: habit.completedDays.includes(key)
    ? habit.completedDays.filter((day) => day !== key)
    : [...habit.completedDays, key].sort() };
}

export function isScheduledDay(habit: Habit, key: string): boolean {
  if (key < habit.createdOn) return false;
  return (calendarDayNumber(key) - calendarDayNumber(habit.createdOn)) % habit.intervalDays === 0;
}

export function monthDays(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1, 12);
  const padding = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0, 12).getDate();
  return [...Array<string | null>(padding).fill(null), ...Array.from({ length: count }, (_, index) => dayKey(new Date(year, month, index + 1, 12)))];
}

export function yearWeeks(year: number): (string | null)[][] {
  const first = new Date(year, 0, 1, 12);
  const cells: (string | null)[] = Array((first.getDay() + 6) % 7).fill(null);
  for (const date = new Date(first); date.getFullYear() === year; date.setDate(date.getDate() + 1)) cells.push(dayKey(date));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

// UTC ordinals count local calendar dates without daylight-saving offsets.
function calendarDayNumber(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

export function habitStreak(habit: Habit, today = dayKey()): number {
  const days = [...new Set(habit.completedDays)].filter((day) => day <= today).sort();
  const last = days.at(-1);
  if (!last || calendarDayNumber(today) - calendarDayNumber(last) > habit.intervalDays) return 0;
  let count = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (calendarDayNumber(days[i]) - calendarDayNumber(days[i - 1]) > habit.intervalDays) break;
    count++;
  }
  return count;
}
