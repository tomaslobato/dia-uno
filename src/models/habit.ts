import { DEFAULT_HABIT_COLOR, isHabitColor } from '../constants/habit-colors.ts';
import { DEFAULT_HABIT_ICON, isHabitIconName, type HabitIconName } from '../constants/habit-icons.ts';

export type HabitKind = 'build' | 'quit';
export type HabitGoalPeriod = 'day' | 'week' | 'month';
export type HabitGoal = { count: number; period: HabitGoalPeriod };
export type HabitSymbol =
  | { type: 'icon'; name: HabitIconName }
  | { type: 'emoji'; value: string };

export type Habit = {
  id: string;
  name: string;
  description: string;
  intervalDays: number;
  createdOn: string;
  completedDays: string[];
  symbol: HabitSymbol;
  color: string;
  kind: HabitKind;
  reminderTime: string | null;
  goal: HabitGoal | null;
  streakEnabled: boolean;
};

export type HabitDraft = {
  name: string;
  description: string;
  symbol: HabitSymbol;
  color: string;
  kind: HabitKind;
  reminderTime: string | null;
  goal: HabitGoal | null;
  streakEnabled: boolean;
  /** Kept for scheduling / legacy; defaults to 1 (daily). */
  intervalDays?: number;
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

function validReminderTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function validGoal(value: unknown): value is HabitGoal {
  if (!value || typeof value !== 'object') return false;
  const goal = value as Partial<HabitGoal>;
  return Number.isSafeInteger(goal.count) && (goal.count as number) >= 1 && (goal.count as number) <= 999
    && (goal.period === 'day' || goal.period === 'week' || goal.period === 'month');
}

function validSymbol(value: unknown): value is HabitSymbol {
  if (!value || typeof value !== 'object') return false;
  const symbol = value as Partial<HabitSymbol>;
  if (symbol.type === 'icon') {
    const name = (symbol as { name?: unknown }).name;
    return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 64;
  }
  if (symbol.type === 'emoji') {
    const emoji = (symbol as { value?: unknown }).value;
    return typeof emoji === 'string' && emoji.trim().length > 0 && emoji.trim().length <= 8;
  }
  return false;
}

function normalizeSymbol(value: unknown): HabitSymbol {
  if (validSymbol(value)) {
    if (value.type === 'emoji') return { type: 'emoji', value: value.value.trim() };
    const name = value.name.trim();
    return { type: 'icon', name: (isHabitIconName(name) ? name : DEFAULT_HABIT_ICON) as HabitIconName };
  }
  if (typeof value === 'string' && value.trim()) {
    const name = value.trim();
    return { type: 'icon', name: (isHabitIconName(name) ? name : DEFAULT_HABIT_ICON) as HabitIconName };
  }
  return { type: 'icon', name: DEFAULT_HABIT_ICON };
}

export function createHabit(draft: HabitDraft, now = new Date()): Habit {
  const intervalDays = Number.isSafeInteger(draft.intervalDays) && (draft.intervalDays as number) >= 1
    ? (draft.intervalDays as number)
    : 1;
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    name: draft.name.trim(),
    description: draft.description.trim(),
    intervalDays,
    createdOn: dayKey(now),
    completedDays: [],
    symbol: normalizeSymbol(draft.symbol),
    color: isHabitColor(draft.color) ? draft.color : DEFAULT_HABIT_COLOR,
    kind: draft.kind === 'quit' ? 'quit' : 'build',
    reminderTime: validReminderTime(draft.reminderTime) ? draft.reminderTime : null,
    goal: draft.goal && validGoal(draft.goal) ? draft.goal : null,
    streakEnabled: draft.streakEnabled !== false,
  };
}

export function parseHabits(value: string | null): Habit[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((habit: unknown) => {
    if (!habit || typeof habit !== 'object') return false;
    const h = habit as Partial<Habit> & { icon?: unknown; emoji?: unknown };
    return typeof h.id === 'string' && typeof h.name === 'string' && Boolean(h.name.trim()) &&
      (h.description === undefined || typeof h.description === 'string') &&
      Number.isSafeInteger(h.intervalDays) && (h.intervalDays as number) >= 1 && validDay(h.createdOn) &&
      Array.isArray(h.completedDays) && h.completedDays.every(validDay) &&
      (h.color === undefined || isHabitColor(h.color)) &&
      (h.kind === undefined || h.kind === 'build' || h.kind === 'quit') &&
      (h.reminderTime === undefined || h.reminderTime === null || validReminderTime(h.reminderTime)) &&
      (h.goal === undefined || h.goal === null || validGoal(h.goal)) &&
      (h.streakEnabled === undefined || typeof h.streakEnabled === 'boolean') &&
      (h.symbol === undefined || validSymbol(h.symbol) || typeof h.symbol === 'string') &&
      (h.icon === undefined || typeof h.icon === 'string') &&
      (h.emoji === undefined || h.emoji === null || typeof h.emoji === 'string');
  })) throw new Error('Invalid habit storage');
  return parsed.map((raw) => {
    const habit = raw as Habit & { icon?: string; emoji?: string | null };
    const legacyEmoji = typeof habit.emoji === 'string' && habit.emoji.trim() ? habit.emoji.trim() : null;
    const legacyIcon = typeof habit.icon === 'string' ? habit.icon : undefined;
    const symbol = habit.symbol !== undefined
      ? normalizeSymbol(habit.symbol)
      : legacyEmoji
        ? { type: 'emoji' as const, value: legacyEmoji }
        : normalizeSymbol(legacyIcon ?? DEFAULT_HABIT_ICON);
    return {
      id: habit.id,
      name: habit.name,
      description: habit.description ?? '',
      intervalDays: habit.intervalDays,
      createdOn: habit.createdOn,
      completedDays: habit.completedDays,
      symbol,
      color: isHabitColor(habit.color) ? habit.color : DEFAULT_HABIT_COLOR,
      kind: habit.kind === 'quit' ? 'quit' : 'build',
      reminderTime: validReminderTime(habit.reminderTime) ? habit.reminderTime : null,
      goal: habit.goal && validGoal(habit.goal) ? habit.goal : null,
      streakEnabled: habit.streakEnabled !== false,
    };
  });
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

function addCalendarDays(key: string, delta: number): string {
  const date = localDay(key);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

function endOfWeek(key: string): string {
  return addCalendarDays(startOfWeek(key), 6);
}

function endOfMonth(key: string): string {
  const date = localDay(key);
  return dayKey(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
}

function goalPeriodBounds(period: HabitGoalPeriod, key: string): { from: string; to: string } {
  if (period === 'week') return { from: startOfWeek(key), to: endOfWeek(key) };
  if (period === 'month') return { from: startOfMonth(key), to: endOfMonth(key) };
  return { from: key, to: key };
}

/** Whether the period goal is still achievable (or already met) as of this day. */
export function isGoalOnTrack(habit: Habit, day: string): boolean {
  if (!habit.goal) return false;
  if (day < habit.createdOn) return false;
  const { count, period } = habit.goal;
  const { from, to } = goalPeriodBounds(period, day);
  const completed = habit.completedDays.filter((key) => key >= from && key <= day).length;
  const daysAfter = calendarDayNumber(to) - calendarDayNumber(day);
  const dayOpen = habit.completedDays.includes(day) ? 0 : 1;
  return completed + daysAfter + dayOpen >= count;
}

function legacyHabitStreak(habit: Habit, today: string): number {
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

export function habitStreak(habit: Habit, today = dayKey()): number {
  if (habit.streakEnabled === false) return 0;
  if (!habit.goal) return legacyHabitStreak(habit, today);
  if (!isGoalOnTrack(habit, today)) return 0;
  let count = 0;
  for (let day = today; day >= habit.createdOn; day = addCalendarDays(day, -1)) {
    if (!isGoalOnTrack(habit, day)) break;
    count++;
  }
  return count;
}

/** Include the actual lifetime, retaining any history recorded before creation. */
export function habitHistoryYears(habit: Habit, today = dayKey()): number[] {
  const currentYear = Number(today.slice(0, 4));
  const dates = [habit.createdOn, ...habit.completedDays.filter((day) => day <= today)];
  const firstYear = Math.min(currentYear, ...dates.map((day) => Number(day.slice(0, 4))));
  return Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index);
}

export function habitProgressRange(habit: Habit, today = dayKey()): { first: string; last: string } | null {
  const days = [...new Set(habit.completedDays)].filter((day) => day <= today).sort();
  return days.length ? { first: days[0], last: days[days.length - 1] } : null;
}

/** A loss belongs to the last completion, so each new streak can be acknowledged separately. */
export function lostHabitStreak(habit: Habit, today = dayKey()): string | null {
  if (habit.streakEnabled === false) return null;
  if (habit.goal) {
    if (isGoalOnTrack(habit, today)) return null;
    const yesterday = addCalendarDays(today, -1);
    if (yesterday < habit.createdOn) return null;
    const previous = habitStreak(habit, yesterday);
    return previous > 0
      ? `${habit.id}:goal:${habit.goal.period}:${habit.goal.count}:${yesterday}`
      : null;
  }
  const last = [...new Set(habit.completedDays)].filter((day) => day <= today).sort().at(-1);
  return last && calendarDayNumber(today) - calendarDayNumber(last) > habit.intervalDays
    ? `${habit.id}:${last}:${habit.intervalDays}` : null;
}

function startOfWeek(key: string): string {
  const date = localDay(key);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dayKey(date);
}

function startOfMonth(key: string): string {
  const date = localDay(key);
  return dayKey(new Date(date.getFullYear(), date.getMonth(), 1, 12));
}

export function habitGoalProgress(habit: Habit, today = dayKey()): { current: number; target: number; period: HabitGoalPeriod } | null {
  if (!habit.goal) return null;
  const { count: target, period } = habit.goal;
  let from = today;
  if (period === 'week') from = startOfWeek(today);
  if (period === 'month') from = startOfMonth(today);
  const current = habit.completedDays.filter((day) => day >= from && day <= today).length;
  return { current, target, period };
}

export function habitGoalLabel(goal: HabitGoal): string {
  const unit = goal.period === 'day' ? (goal.count === 1 ? 'vez al día' : 'veces al día')
    : goal.period === 'week' ? (goal.count === 1 ? 'vez a la semana' : 'veces a la semana')
      : (goal.count === 1 ? 'vez al mes' : 'veces al mes');
  return `${goal.count} ${unit}`;
}

export function habitGoalProgressLabel(habit: Habit, today = dayKey()): string | null {
  const progress = habitGoalProgress(habit, today);
  if (!progress) return null;
  const period = progress.period === 'day' ? 'hoy' : progress.period === 'week' ? 'esta semana' : 'este mes';
  return `(${progress.current}/${progress.target} ${period})`;
}

export function formatReminderTime(value: string): string {
  return value;
}

export function reminderTimeToDate(value: string, base = new Date()): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date(base);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function dateToReminderTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
