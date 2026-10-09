import assert from 'node:assert/strict';
import test from 'node:test';
import { createHabit, dayKey, localDay, monthDays, yearWeeks, parseHabits, previousDay, isScheduledDay, toggleHabitDay, habitStreak } from '../src/models/habit.ts';

test('habit records preserve names, frequency and completed days', () => {
  const habit = createHabit('  Leer  ', 3, localDay('2026-10-08'));
  assert.equal(habit.name, 'Leer');
  assert.equal(habit.createdOn, '2026-10-08');
  const done = toggleHabitDay(habit, '2026-10-08', '2026-10-08');
  assert.deepEqual(parseHabits(JSON.stringify([done])), [done]);
  assert.deepEqual(toggleHabitDay(done, '2026-10-08', '2026-10-08').completedDays, []);
  assert.deepEqual(toggleHabitDay(habit, '2026-10-09', '2026-10-08'), habit);
  assert.deepEqual(toggleHabitDay(habit, '2026-02-30', '2026-10-08'), habit);
  assert.deepEqual(toggleHabitDay(habit, '2026-10-07', '2026-10-08').completedDays, ['2026-10-07']);
});
test('frequencies use calendar days across month and year boundaries', () => {
  for (const interval of [1, 2, 3, 4]) {
    const habit = createHabit('Caminar', interval, localDay('2025-12-30'));
    const next = localDay(habit.createdOn); next.setDate(next.getDate() + interval);
    assert.equal(isScheduledDay(habit, dayKey(next)), true);
    assert.equal(isScheduledDay(habit, '2025-12-29'), false);
    if (interval > 1) assert.equal(isScheduledDay(habit, '2025-12-31'), false);
  }
  assert.equal(previousDay(localDay('2026-01-01')), '2025-12-31');
  assert.equal(previousDay(localDay('2024-03-01')), '2024-02-29');
});
test('month and yearly grids contain every calendar day exactly once', () => {
  assert.equal(monthDays(2024, 1).filter(Boolean).length, 29);
  assert.equal(monthDays(2026, 1).filter(Boolean).length, 28);
  for (const year of [2024, 2025, 2026]) {
    const weeks = yearWeeks(year);
    assert.ok(weeks.every((week) => week.length === 7));
    const days = weeks.flat().filter(Boolean);
    assert.equal(days.length, year === 2024 ? 366 : 365);
    assert.equal(new Set(days).size, days.length);
    assert.equal(days[0], `${year}-01-01`);
    assert.equal(days.at(-1), `${year}-12-31`);
  }
});
test('invalid storage does not silently replace habit history', () => {
  assert.deepEqual(parseHabits(null), []);
  const habit = createHabit('Leer', 1);
  for (const invalid of [{ ...habit, intervalDays: 0 }, { ...habit, completedDays: ['2026-02-30'] }, { ...habit, name: ' ' }]) assert.throws(() => parseHabits(JSON.stringify([invalid])));
  assert.throws(() => parseHabits('{broken'));
});

test('streak counts completions within the chosen interval and expires only after it', () => {
  const habit = { ...createHabit('Leer', 3), completedDays: ['2026-09-28', '2026-10-01', '2026-10-05', '2026-10-08'] };
  assert.equal(habitStreak(habit, '2026-10-08'), 2);
  assert.equal(habitStreak(habit, '2026-10-11'), 2);
  assert.equal(habitStreak(habit, '2026-10-12'), 0);
  assert.equal(habitStreak(toggleHabitDay(habit, '2026-10-12', '2026-10-12'), '2026-10-12'), 1);
  assert.equal(habitStreak({ ...habit, completedDays: [] }, '2026-10-08'), 0);
  assert.equal(habitStreak({ ...habit, completedDays: ['2026-10-08', '2026-10-08', '2026-10-07'] }, '2026-10-08'), 2);
});
test('daily streaks bridge year boundaries and react to yesterday edits', () => {
  const habit = { ...createHabit('Leer', 1), completedDays: ['2025-12-30', '2025-12-31', '2026-01-01'] };
  assert.equal(habitStreak(habit, '2026-01-01'), 3);
  assert.equal(habitStreak(habit, '2026-01-02'), 3);
  assert.equal(habitStreak(habit, '2026-01-03'), 0);
  assert.equal(habitStreak(toggleHabitDay(habit, '2025-12-31', '2026-01-01'), '2026-01-01'), 1);
  assert.equal(habitStreak({ ...habit, intervalDays: 2, completedDays: ['2024-02-28', '2024-03-01'] }, '2024-03-03'), 2);
  assert.equal(parseHabits(JSON.stringify([{ ...habit, intervalDays: 10 }]))[0].intervalDays, 10);
});
