import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesTaskDate, compareTaskDueDate, createTask, isOverdue, parseTasks } from '../src/models/task.ts';

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
