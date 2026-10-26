import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_HABIT_COLOR } from '../src/constants/habit-colors.ts';
import { DEFAULT_HABIT_ICON } from '../src/constants/habit-icons.ts';
import { habitGoalProgress, habitGoalProgressLabel, isGoalOnTrack, habitProgressRange, lostHabitStreak, habitHistoryYears, createHabit, dayKey, localDay, monthDays, yearWeeks, parseHabits, previousDay, isScheduledDay, toggleHabitDay, habitStreak } from '../src/models/habit.ts';

function draft(overrides = {}) {
  return {
    name: 'Leer',
    description: '',
    symbol: { type: 'icon', name: DEFAULT_HABIT_ICON },
    color: DEFAULT_HABIT_COLOR,
    kind: 'build',
    reminderTime: null,
    goal: null,
    streakEnabled: true,
    intervalDays: 1,
    ...overrides,
  };
}

test('habit records preserve names, frequency and completed days', () => {
  const habit = createHabit(draft({ name: '  Leer  ', intervalDays: 3 }), localDay('2026-10-08'));
  assert.equal(habit.name, 'Leer');
  assert.equal(habit.createdOn, '2026-10-08');
  assert.equal(habit.color, DEFAULT_HABIT_COLOR);
  assert.equal(habit.kind, 'build');
  assert.equal(habit.streakEnabled, true);
  assert.deepEqual(habit.symbol, { type: 'icon', name: DEFAULT_HABIT_ICON });
  const done = toggleHabitDay(habit, '2026-10-08', '2026-10-08');
  assert.deepEqual(parseHabits(JSON.stringify([done])), [done]);
  assert.deepEqual(toggleHabitDay(done, '2026-10-08', '2026-10-08').completedDays, []);
  assert.deepEqual(toggleHabitDay(habit, '2026-10-09', '2026-10-08'), habit);
  assert.deepEqual(toggleHabitDay(habit, '2026-02-30', '2026-10-08'), habit);
  assert.deepEqual(toggleHabitDay(habit, '2026-10-07', '2026-10-08').completedDays, ['2026-10-07']);
});
test('frequencies use calendar days across month and year boundaries', () => {
  for (const interval of [1, 2, 3, 4]) {
    const habit = createHabit(draft({ name: 'Caminar', intervalDays: interval }), localDay('2025-12-30'));
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
  const habit = createHabit(draft({ name: 'Leer', intervalDays: 1 }));
  for (const invalid of [{ ...habit, intervalDays: 0 }, { ...habit, completedDays: ['2026-02-30'] }, { ...habit, name: ' ' }]) assert.throws(() => parseHabits(JSON.stringify([invalid])));
  assert.throws(() => parseHabits('{broken'));
});

test('legacy habits without customization fields still parse', () => {
  const legacy = {
    id: 'legacy',
    name: 'Caminar',
    description: '',
    intervalDays: 1,
    createdOn: '2026-10-01',
    completedDays: ['2026-10-01'],
  };
  const [habit] = parseHabits(JSON.stringify([legacy]));
  assert.equal(habit.color, DEFAULT_HABIT_COLOR);
  assert.equal(habit.kind, 'build');
  assert.equal(habit.streakEnabled, true);
  assert.equal(habit.reminderTime, null);
  assert.equal(habit.goal, null);
  assert.deepEqual(habit.symbol, { type: 'icon', name: DEFAULT_HABIT_ICON });
});

test('goal progress counts completions in the selected period', () => {
  const habit = createHabit(draft({
    name: 'Agua',
    goal: { count: 3, period: 'week' },
  }), localDay('2026-10-28'));
  // Week of Wed 2026-10-28 starts Monday 2026-10-26.
  const tracked = { ...habit, completedDays: ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-29'] };
  assert.deepEqual(habitGoalProgress(tracked, '2026-10-28'), { current: 2, target: 3, period: 'week' });
  assert.equal(habitGoalProgressLabel(tracked, '2026-10-28'), '(2/3 esta semana)');
  assert.equal(habitGoalProgressLabel({ ...habit, goal: { count: 2, period: 'day' }, completedDays: [] }, '2026-10-28'), '(0/2 hoy)');
  assert.equal(habitGoalProgress({ ...habit, goal: null }, '2026-10-28'), null);
});

test('weekly goal streaks count every on-track day and break when the week becomes impossible', () => {
  // Week of Mon 2026-10-26 … Sun 2026-11-01. Goal: 4 days.
  const habit = createHabit(draft({
    name: 'Gym',
    goal: { count: 4, period: 'week' },
    streakEnabled: true,
  }), localDay('2026-10-26'));
  assert.equal(isGoalOnTrack(habit, '2026-10-26'), true);
  assert.equal(habitStreak(habit, '2026-10-26'), 1);
  assert.equal(habitStreak(habit, '2026-10-29'), 4); // Thu, still 4 days left including Thu
  // Friday with zero completions: Fri–Sun = 3 slots < 4 → lost.
  assert.equal(isGoalOnTrack(habit, '2026-10-30'), false);
  assert.equal(habitStreak(habit, '2026-10-30'), 0);
  assert.ok(lostHabitStreak(habit, '2026-10-30'));
  // With two completions earlier in the week, Friday is still possible (2 + Fri–Sun).
  const progressing = { ...habit, completedDays: ['2026-10-26', '2026-10-27'] };
  assert.equal(isGoalOnTrack(progressing, '2026-10-30'), true);
  assert.equal(habitStreak(progressing, '2026-10-30'), 5);
  // End of week without reaching 4.
  const short = { ...habit, completedDays: ['2026-10-26', '2026-10-28'] };
  assert.equal(isGoalOnTrack(short, '2026-11-01'), false);
  assert.equal(habitStreak(short, '2026-11-01'), 0);
  assert.ok(lostHabitStreak(short, '2026-11-01'));
  // Met the goal mid-week: streak keeps counting through the rest of the week.
  const met = { ...habit, completedDays: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'] };
  assert.equal(isGoalOnTrack(met, '2026-11-01'), true);
  assert.equal(habitStreak(met, '2026-11-01'), 7);
});

test('streak counts completions within the chosen interval and expires only after it', () => {
  const habit = { ...createHabit(draft({ name: 'Leer', intervalDays: 3 })), completedDays: ['2026-09-28', '2026-10-01', '2026-10-05', '2026-10-08'] };
  assert.equal(habitStreak(habit, '2026-10-08'), 2);
  assert.equal(habitStreak(habit, '2026-10-11'), 2);
  assert.equal(habitStreak(habit, '2026-10-12'), 0);
  assert.equal(habitStreak(toggleHabitDay(habit, '2026-10-12', '2026-10-12'), '2026-10-12'), 1);
  assert.equal(habitStreak({ ...habit, completedDays: [] }, '2026-10-08'), 0);
  assert.equal(habitStreak({ ...habit, completedDays: ['2026-10-08', '2026-10-08', '2026-10-07'] }, '2026-10-08'), 2);
  assert.equal(habitStreak({ ...habit, streakEnabled: false }, '2026-10-08'), 0);
});
test('daily streaks bridge year boundaries and react to yesterday edits', () => {
  const habit = { ...createHabit(draft({ name: 'Leer', intervalDays: 1 })), completedDays: ['2025-12-30', '2025-12-31', '2026-01-01'] };
  assert.equal(habitStreak(habit, '2026-01-01'), 3);
  assert.equal(habitStreak(habit, '2026-01-02'), 3);
  assert.equal(habitStreak(habit, '2026-01-03'), 0);
  assert.equal(habitStreak(toggleHabitDay(habit, '2025-12-31', '2026-01-01'), '2026-01-01'), 1);
  assert.equal(habitStreak({ ...habit, intervalDays: 2, completedDays: ['2024-02-28', '2024-03-01'] }, '2024-03-03'), 2);
  assert.equal(parseHabits(JSON.stringify([{ ...habit, intervalDays: 10 }]))[0].intervalDays, 10);
});

test('habit history includes its real years instead of three fixed years', () => {
  const habit = createHabit(draft({ name: 'Leer', intervalDays: 1 }), localDay('2026-10-10'));
  assert.deepEqual(habitHistoryYears(habit, '2026-10-10'), [2026]);
  assert.deepEqual(habitHistoryYears({ ...habit, createdOn: '2022-11-01' }, '2026-10-10'), [2026, 2025, 2024, 2023, 2022]);
  assert.deepEqual(habitHistoryYears({ ...habit, completedDays: ['2024-12-31'] }, '2026-10-10'), [2026, 2025, 2024]);
  assert.deepEqual(habitHistoryYears({ ...habit, completedDays: ['2027-01-01'] }, '2026-10-10'), [2026]);
});

test('streak loss waits for the configured interval and identifies each expired streak', () => {
  const habit = { ...createHabit(draft({ name: 'Leer', intervalDays: 2 }), localDay('2026-10-01')), completedDays: ['2026-10-01', '2026-10-03'] };
  assert.equal(lostHabitStreak(habit, '2026-10-05'), null);
  const loss = lostHabitStreak(habit, '2026-10-06');
  assert.ok(loss);
  assert.equal(lostHabitStreak(habit, '2026-10-10'), loss);
  assert.equal(lostHabitStreak({ ...habit, completedDays: [] }, '2026-10-10'), null);
  assert.equal(lostHabitStreak({ ...habit, streakEnabled: false }, '2026-10-10'), null);
  const restarted = { ...habit, completedDays: [...habit.completedDays, '2026-10-06'] };
  assert.equal(lostHabitStreak(restarted, '2026-10-06'), null);
  assert.notEqual(lostHabitStreak(restarted, '2026-10-09'), loss);
});

test('progress range spans the first through last completed day, keeping gaps and excluding future dates', () => {
  const habit = { ...createHabit(draft({ name: 'Leer', intervalDays: 1 }), localDay('2022-01-01')), completedDays: ['2026-01-03', '2024-12-30', '2024-12-30', '2027-01-01'] };
  assert.deepEqual(habitProgressRange(habit, '2026-10-10'), { first: '2024-12-30', last: '2026-01-03' });
  assert.equal(habitProgressRange({ ...habit, completedDays: [] }, '2026-10-10'), null);
  assert.deepEqual(habitProgressRange({ ...habit, completedDays: ['2026-01-03'] }, '2026-10-10'), { first: '2026-01-03', last: '2026-01-03' });
});
