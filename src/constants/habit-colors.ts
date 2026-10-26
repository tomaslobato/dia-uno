/** Fifteen swatches for habit accent color. */
export const HABIT_COLORS = [
  '#E57373',
  '#FF8A65',
  '#FFB74D',
  '#FFD54F',
  '#DCE775',
  '#81C784',
  '#4DB6AC',
  '#4DD0E1',
  '#64B5F6',
  '#7986CB',
  '#9575CD',
  '#BA68C8',
  '#F06292',
  '#90A4AE',
  '#78909C',
] as const;

export type HabitColor = (typeof HABIT_COLORS)[number];

export const DEFAULT_HABIT_COLOR: HabitColor = HABIT_COLORS[0];

export function isHabitColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[a-fA-F\d]{6}$/.test(value);
}
