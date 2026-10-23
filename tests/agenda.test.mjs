import assert from 'node:assert/strict';
import test from 'node:test';
import { agendaDayLabel, shiftAgendaDay, agendaHabitsForDay, compareAgendaTasks, calendarRangeDays, calendarWeekDays, agendaWeekTitle, calendarMonthDays, taskAgendaDay, agendaTasksForDay, overdueAgendaDays, agendaDayTitle, validAgendaDay } from '../src/models/agenda.ts';
import { createTask } from '../src/models/task.ts';
const task = (day, overrides = {}) => ({ ...createTask({ title: 'Prueba', description: '', dueAt: day ? new Date(...day).toISOString() : null, hasTime: false }), ...overrides });

test('daily recurring series shows the same task on every agenda day without cloning', () => {
  const series = createTask({
    title: 'Agua',
    description: '',
    dueAt: new Date(2026, 9, 23, 8).toISOString(),
    hasTime: true,
    repeatEvery: 1,
    repeatUnit: 'days',
  });
  const friday = agendaTasksForDay([series], '2026-10-23');
  const saturday = agendaTasksForDay([series], '2026-10-24');
  const nextWeek = agendaTasksForDay([series], '2026-10-30');
  assert.equal(friday.length, 1);
  assert.equal(saturday.length, 1);
  assert.equal(nextWeek.length, 1);
  assert.equal(friday[0].id, series.id);
  assert.equal(saturday[0].id, series.id);
  assert.equal(friday[0].dueAt !== saturday[0].dueAt, true);
  assert.equal(agendaTasksForDay([series], '2026-10-22').length, 0);
});

test('calendar includes every month day once in Monday-first complete weeks', () => {
  for (const [year, month] of [[2028, 1], [2026, 2], [2026, 11], [2027, 0]]) {
    const weeks = calendarMonthDays(new Date(year, month, 1));
    const days = weeks.flat();
    assert.ok(weeks.every((week) => week.length === 7));
    assert.equal(new Date(`${days[0]}T12:00:00`).getDay(), 1);
    assert.equal(new Set(days).size, days.length);
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    assert.equal(days.filter((day) => day.startsWith(prefix)).length, new Date(year, month + 1, 0).getDate());
  }
});
test('agenda uses local due days, includes completed tasks and excludes undated tasks', () => {
  const early = task([2026, 9, 13, 8], { hasTime: true });
  const later = task([2026, 9, 13, 18], { hasTime: true, completed: true });
  const noTime = task([2026, 9, 13, 12]);
  assert.equal(taskAgendaDay(early), '2026-10-13');
  assert.equal(taskAgendaDay(task(null)), null);
  assert.deepEqual(agendaTasksForDay([later, task(null), task([2026, 9, 14]), early, noTime], '2026-10-13'), [noTime, early, later]);
});
test('overdue dots mark original days and today without duplicating tasks', () => {
  const yesterday = task([2026, 9, 12]);
  const done = task([2026, 9, 11], { completed: true });
  const today = task([2026, 9, 13]);
  const now = new Date(2026, 9, 13, 12);
  const days = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'];
  assert.deepEqual([...overdueAgendaDays([yesterday, done, today, task(null), task([2026, 9, 14])], days, now)].sort(), ['2026-10-12', '2026-10-13']);
  assert.deepEqual([...overdueAgendaDays([today], days, now)], []);
  assert.deepEqual([...overdueAgendaDays([task([2026, 9, 13, 8], { hasTime: true })], days, now)], ['2026-10-13']);
  assert.deepEqual(agendaTasksForDay([yesterday, today], '2026-10-13'), [today]);
});
test('day titles and route validation handle leap days and year boundaries', () => {
  const now = new Date(2026, 11, 31, 23);
  assert.equal(agendaDayTitle('2026-12-31', now), 'Tareas de hoy');
  assert.equal(agendaDayTitle('2027-01-01', now), 'Tareas de mañana');
  assert.equal(agendaDayTitle('2027-01-02', now), 'Tareas del 2 de enero de 2027');
  assert.equal(validAgendaDay('2028-02-29'), true);
  for (const bad of ['2026-02-29', '2026-13-01', 'invalid', ['2026-10-13'], undefined]) assert.equal(validAgendaDay(bad), false);
});

test('weekly view spans Monday to Sunday across months, years and leap days', () => {
  const days = calendarWeekDays(new Date(2026, 11, 31));
  assert.deepEqual(days, ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(new Date(`${days[0]}T12:00:00`).getDay(), 1);
  assert.equal(new Date(`${days[6]}T12:00:00`).getDay(), 0);
  assert.equal(calendarWeekDays(new Date(2028, 1, 29)).includes('2028-02-29'), true);
  assert.match(agendaWeekTitle(days), /2026.*2027/);
  assert.equal(agendaWeekTitle(calendarWeekDays(new Date(2026, 9, 13))), '12 – 18 de octubre de 2026');
});

test('mobile ranges show exactly two, three or four consecutive days from the anchor', () => {
  const anchor = new Date(2026, 11, 31);
  for (const count of [2, 3, 4]) {
    const days = calendarRangeDays(anchor, count);
    assert.equal(days.length, count);
    assert.equal(days[0], '2026-12-31');
    assert.equal(days[count - 1], `2027-01-0${count - 1}`);
    assert.match(agendaWeekTitle(days), /2026.*2027/);
  }
  assert.deepEqual(calendarRangeDays(new Date(2028, 1, 28), 3), ['2028-02-28', '2028-02-29', '2028-03-01']);
});

test('calendar sorts by due date and time, with stars first only in detailed views', () => {
  const early = task([2026, 9, 13, 8], { hasTime: true });
  const starEarly = task([2026, 9, 13, 10], { hasTime: true, starred: true });
  const starLate = task([2026, 9, 13, 18], { hasTime: true, starred: true });
  const late = task([2026, 9, 13, 20], { hasTime: true });
  assert.deepEqual([late, starLate, early, starEarly].sort((a, b) => compareAgendaTasks(a, b)), [early, starEarly, starLate, late]);
  assert.deepEqual([late, starLate, early, starEarly].sort((a, b) => compareAgendaTasks(a, b, true)), [starEarly, starLate, early, late]);
});

test('today can also show overdue tasks without changing their date or duplicating tasks', () => {
  const now = new Date(2026, 9, 13, 12);
  const overdue = task([2026, 9, 12]);
  const today = task([2026, 9, 13]);
  const completed = task([2026, 9, 11], { completed: true });
  const tasks = [today, overdue, completed];
  assert.deepEqual(agendaTasksForDay(tasks, '2026-10-13', true, now), [overdue, today]);
  assert.deepEqual(agendaTasksForDay(tasks, '2026-10-12', true, now), [overdue]);
  assert.equal(overdue.dueAt, new Date(2026, 9, 12).toISOString());
  assert.deepEqual(agendaTasksForDay([{ ...overdue, completed: true }, today], '2026-10-13', true, now), [today]);
});

test('agenda habits follow their frequency and retain completed days outside that schedule', () => {
  const habit = { id: 'habit', name: 'Leer', description: '', intervalDays: 3, createdOn: '2026-10-13', completedDays: ['2026-10-14'] };
  assert.deepEqual(agendaHabitsForDay([habit], '2026-10-13', '2026-10-16'), [habit]);
  assert.deepEqual(agendaHabitsForDay([habit], '2026-10-14', '2026-10-16'), [habit]);
  assert.deepEqual(agendaHabitsForDay([habit], '2026-10-15', '2026-10-16'), []);
  assert.deepEqual(agendaHabitsForDay([habit], '2026-10-16', '2026-10-16'), [habit]);
  assert.deepEqual(agendaHabitsForDay([habit], '2026-10-12', '2026-10-16'), []);
});

test('day carousel labels and neighbors follow local calendar days across boundaries', () => {
  const now = new Date(2026, 11, 31, 23, 59);
  assert.equal(agendaDayLabel('2026-12-31', now), 'Hoy');
  assert.equal(agendaDayLabel('2026-12-30', now), 'Ayer');
  assert.equal(agendaDayLabel('2027-01-01', now), 'Mañana');
  assert.equal(shiftAgendaDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftAgendaDay('2028-03-01', -1), '2028-02-29');
});

test('habits are displayed only through today, with past completions retained', () => {
  const habit = { id: 'daily', name: 'Leer', description: '', intervalDays: 1, createdOn: '2026-10-10', completedDays: ['2026-10-11'] };
  assert.deepEqual(agendaHabitsForDay([habit], '2026-10-11', '2026-10-13'), [habit]);
  assert.deepEqual(agendaHabitsForDay([habit], '2026-10-12', '2026-10-13'), [habit]);
  assert.deepEqual(agendaHabitsForDay([habit], '2026-10-13', '2026-10-13'), [habit]);
  assert.deepEqual(agendaHabitsForDay([habit], '2026-10-14', '2026-10-13'), []);
});
