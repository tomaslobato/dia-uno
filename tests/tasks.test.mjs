import assert from 'node:assert/strict';
import test from 'node:test';
import { staysInTaskSchedule, taskDateSection, formatDueDate, matchesTaskDate, compareTaskDueDate, createTask, isOverdue, parseTasks } from '../src/models/task.ts';

const draft = { title: '  Comprar pan  ', description: ' Integral ', dueAt: null, hasTime: false };

test('task text is trimmed and a new task starts pending', () => {
  const task = createTask(draft);
  assert.equal(task.title, 'Comprar pan');
  assert.equal(task.description, 'Integral');
  assert.equal(task.completed, false);
  assert.ok(task.id);
});

test('stored completed tasks retain their date, time and identity', () => {
  const task = { ...createTask(draft), completed: true, dueAt: '2026-10-12T18:30:00.000Z', hasTime: true };
  assert.deepEqual(parseTasks(JSON.stringify([task])), [task]);
  assert.deepEqual(parseTasks(null), []);
});

test('invalid stored data is rejected instead of silently deleting tasks', () => {
  assert.throws(() => parseTasks('{broken'));
  assert.throws(() => parseTasks(JSON.stringify({ tasks: [] })));
  assert.throws(() => parseTasks(JSON.stringify([{ ...createTask(draft), completed: 'yes' }])));
  assert.throws(() => parseTasks(JSON.stringify([{ ...createTask(draft), dueAt: 'invalid-date' }])));
});

test('a date without a time remains valid for the whole day', () => {
  const morning = new Date();
  morning.setHours(0, 0, 0, 0);
  const task = { ...createTask(draft), dueAt: morning.toISOString() };
  assert.equal(isOverdue(task), false);
  assert.equal(isOverdue({ ...task, hasTime: true, dueAt: new Date(Date.now() - 60000).toISOString() }), true);
  assert.equal(isOverdue({ ...task, hasTime: true, completed: true }), false);
});

test('tasks sort by date and time with undated tasks last and stable ties', () => {
  const task = (title, dueAt, hasTime = true) => createTask({ ...draft, title, dueAt, hasTime });
  const tasks = [
    task('Sin fecha A', null),
    task('Tarde', '2026-10-12T18:30:00'),
    task('Día siguiente', '2026-10-13T00:00:00'),
    task('Solo fecha', '2026-10-12T12:00:00', false),
    task('Mañana', '2026-10-12T08:00:00'),
    task('Sin fecha B', null),
    task('Misma hora', '2026-10-12T08:00:00'),
    task('Día anterior', '2026-10-11T23:00:00'),
  ];
  const sorted = tasks.toSorted(compareTaskDueDate);
  assert.deepEqual(sorted.map((t) => t.title), ['Día anterior', 'Solo fecha', 'Mañana', 'Misma hora', 'Tarde', 'Día siguiente', 'Sin fecha A', 'Sin fecha B']);
  assert.equal(tasks[0].title, 'Sin fecha A');
  assert.equal(compareTaskDueDate({ ...tasks[1], completed: true }, tasks[4]) > 0, true);
});

test('today and Monday-to-Sunday filters use local dates with exclusive end boundaries', () => {
  const now = new Date('2026-10-08T12:00:00');
  const task = (date) => createTask({ ...draft, dueAt: date, hasTime: true });
  assert.equal(matchesTaskDate(task('2026-10-08T00:00:00'), 'today', now), true);
  assert.equal(matchesTaskDate(task('2026-10-08T23:59:59'), 'today', now), true);
  assert.equal(matchesTaskDate(task('2026-10-09T00:00:00'), 'today', now), false);
  assert.equal(matchesTaskDate(task('2026-10-05T00:00:00'), 'week', now), true);
  assert.equal(matchesTaskDate(task('2026-10-11T23:59:59'), 'week', now), true);
  assert.equal(matchesTaskDate(task('2026-10-12T00:00:00'), 'week', now), false);
  assert.equal(matchesTaskDate(task('2026-10-04T23:59:59'), 'week', now), false);
  assert.equal(matchesTaskDate(task(null), 'today', now), false);
  assert.equal(matchesTaskDate(task(null), 'all', now), true);
  assert.equal(matchesTaskDate(task('2026-10-05T12:00:00'), 'week', new Date('2026-10-11T12:00:00')), true);
  assert.equal(matchesTaskDate(task('2025-12-29T12:00:00'), 'week', new Date('2026-01-01T12:00:00')), true);
});

test('stars persist and old tasks without stars load without losing their information', () => {
  const task = createTask(draft);
  assert.equal(task.starred, false);
  assert.deepEqual(parseTasks(JSON.stringify([{ ...task, starred: true }])), [{ ...task, starred: true }]);
  const { starred, ...legacy } = task;
  assert.deepEqual(parseTasks(JSON.stringify([legacy])), [task]);
  assert.throws(() => parseTasks(JSON.stringify([{ ...task, starred: 'yes' }])));
});

test('past due dates use calendar-day labels across hours and year boundaries', () => {
  const today = new Date(2026, 0, 2, 0, 5);
  assert.equal(formatDueDate(new Date(2026, 0, 1, 23, 59).toISOString(), false, today), 'Ayer');
  assert.equal(formatDueDate(new Date(2025, 11, 31, 18, 30).toISOString(), false, today), 'Hace 2 días');
  assert.equal(formatDueDate(new Date(2025, 11, 30).toISOString(), false, today), 'Hace 3 días');
  assert.equal(formatDueDate(new Date(2026, 0, 2).toISOString(), false, today), 'Hoy');
  assert.equal(formatDueDate(new Date(2026, 0, 3).toISOString(), false, today), 'Mañana');
  assert.match(formatDueDate(new Date(2026, 0, 1, 18, 30).toISOString(), true, today), /^Ayer, 18:30$/);
});

test('tasks can be unassigned and legacy main-list assignments become unassigned', () => {
  assert.equal(createTask(draft).listId, null);
  assert.equal(createTask({ ...draft, listId: null }).listId, null);
  assert.equal(createTask({ ...draft, listId: 'list-work' }).listId, 'list-work');
  assert.equal(parseTasks(JSON.stringify([{ ...createTask(draft), listId: 'mis-tareas' }]))[0].listId, null);
});

test('date sections are exclusive and use calendar days and Monday week boundaries', () => {
  const now = new Date(2026, 9, 9, 23, 30);
  const section = (year, month, day) => taskDateSection({ ...createTask(draft), dueAt: new Date(year, month, day, 12).toISOString() }, now);
  assert.equal(section(2026, 9, 8), 'Vencidas');
  assert.equal(section(2026, 9, 9), 'Hoy');
  assert.equal(section(2026, 9, 10), 'Mañana');
  assert.equal(section(2026, 9, 11), 'Esta semana');
  assert.equal(section(2026, 9, 12), 'Futuro');
  assert.equal(taskDateSection(createTask(draft), now), 'Sin fecha');
  assert.equal(taskDateSection({ ...createTask(draft), dueAt: new Date(2027, 0, 1).toISOString() }, new Date(2026, 11, 31)), 'Mañana');
  assert.equal(taskDateSection({ ...createTask(draft), dueAt: new Date(2026, 9, 12).toISOString() }, new Date(2026, 9, 11)), 'Mañana');
});

test('completed tasks scheduled today stay above until the local day ends', () => {
  const now = new Date(2026, 11, 31, 23, 59);
  const completed = { ...createTask(draft), completed: true, dueAt: new Date(2026, 11, 31, 9).toISOString(), hasTime: true };
  assert.equal(staysInTaskSchedule(completed, now), true);
  assert.equal(staysInTaskSchedule(completed, new Date(2027, 0, 1)), false);
  assert.equal(staysInTaskSchedule({ ...completed, completed: false }, new Date(2027, 0, 1)), true);
  assert.equal(taskDateSection({ ...completed, completed: false }, new Date(2027, 0, 1)), 'Vencidas');
  assert.equal(staysInTaskSchedule({ ...completed, hasTime: false }, now), true);
  assert.equal(staysInTaskSchedule({ ...completed, dueAt: null }, now), false);
  assert.equal(staysInTaskSchedule({ ...completed, dueAt: new Date(2027, 0, 1).toISOString() }, now), false);
});
