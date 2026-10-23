import assert from 'node:assert/strict';
import test from 'node:test';
import { staysInTaskSchedule, taskDateSection, formatDueDate, formatTaskRepeat, formatTaskDueInSection, matchesTaskDate, compareTaskDueDate, createTask, getTaskReminderAt, isOverdue, materializeSiblingDueAts, nextRecurringDueAt, parseTasks } from '../src/models/task.ts';
import { dayKey } from '../src/models/habit.ts';

const draft = { title: '  Comprar pan  ', description: ' Integral ', dueAt: null, hasTime: false };

test('task text is trimmed and a new task starts pending', () => {
  const task = createTask(draft);
  assert.equal(task.title, 'Comprar pan');
  assert.equal(task.description, 'Integral');
  assert.equal(task.completed, false);
  assert.ok(task.id);
  assert.equal(task.reminderMinutes, 30);
});

test('task reminders default to 30 minutes, can be disabled or customized, and old records migrate safely', () => {
  const base = createTask(draft);
  assert.equal(createTask({ ...draft, reminderMinutes: null }).reminderMinutes, null);
  assert.equal(createTask({ ...draft, reminderMinutes: 45 }).reminderMinutes, 45);
  const { reminderMinutes: _reminder, ...legacy } = base;
  assert.equal(parseTasks(JSON.stringify([legacy]))[0].reminderMinutes, 30);
  assert.throws(() => parseTasks(JSON.stringify([{ ...base, reminderMinutes: 0 }])));
  assert.throws(() => parseTasks(JSON.stringify([{ ...base, reminderMinutes: 10081 }])));
});

test('date-only reminders use 9 AM as the reminder anchor and support day offsets', () => {
  const dueAt = new Date(2026, 9, 20).toISOString();
  const dateOnly = { ...createTask(draft), dueAt, hasTime: false, reminderMinutes: 1440 };
  const reminder = new Date(getTaskReminderAt(dateOnly));
  assert.equal(reminder.getFullYear(), 2026);
  assert.equal(reminder.getMonth(), 9);
  assert.equal(reminder.getDate(), 19);
  assert.equal(reminder.getHours(), 9);
  const thirtyMinutes = new Date(getTaskReminderAt({ ...dateOnly, reminderMinutes: 30 }));
  assert.equal(thirtyMinutes.getDate(), 20);
  assert.equal(thirtyMinutes.getHours(), 8);
  assert.equal(thirtyMinutes.getMinutes(), 30);
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

test('recurrence labels cover days, weeks with weekday, months and years', () => {
  const tuesday = new Date(2026, 9, 13, 12).toISOString(); // martes
  assert.equal(formatTaskRepeat({ repeatEvery: null, repeatUnit: null, dueAt: tuesday, repeatWeekdays: [] }), null);
  assert.equal(formatTaskRepeat({ repeatEvery: 1, repeatUnit: 'days', dueAt: tuesday, repeatWeekdays: [] }), 'Todos los días');
  assert.equal(formatTaskRepeat({ repeatEvery: 3, repeatUnit: 'days', dueAt: tuesday, repeatWeekdays: [] }), 'Cada 3 días');
  assert.equal(formatTaskRepeat({ repeatEvery: 1, repeatUnit: 'weeks', dueAt: tuesday, repeatWeekdays: [2] }), 'Todos los martes');
  assert.equal(formatTaskRepeat({ repeatEvery: 2, repeatUnit: 'weeks', dueAt: tuesday, repeatWeekdays: [2] }), 'Cada 2 semanas los martes');
  assert.match(formatTaskRepeat({ repeatEvery: 1, repeatUnit: 'weeks', dueAt: tuesday, repeatWeekdays: [1, 3, 5] }), /lunes.*miércoles.*viernes/);
  assert.equal(formatTaskRepeat({ repeatEvery: 1, repeatUnit: 'months', dueAt: tuesday, repeatWeekdays: [] }), 'Todos los meses');
  assert.equal(formatTaskRepeat({ repeatEvery: 2, repeatUnit: 'years', dueAt: tuesday, repeatWeekdays: [] }), 'Cada 2 años');
});

test('weekly multi-day series creates same-week siblings and advances across selected weekdays', () => {
  const monday = new Date(2026, 9, 12, 9, 30); // lun 12 oct 2026
  const task = createTask({
    title: 'Gym',
    description: '',
    dueAt: monday.toISOString(),
    hasTime: true,
    repeatEvery: 1,
    repeatUnit: 'weeks',
    repeatWeekdays: [1, 3, 5],
  });
  assert.deepEqual(task.repeatWeekdays, [1, 3, 5]);
  const siblings = materializeSiblingDueAts(task);
  assert.deepEqual(siblings.map((due) => new Date(due).getDay()), [3, 5]);
  assert.deepEqual(siblings.map((due) => dayKey(new Date(due))), ['2026-10-14', '2026-10-16']);
  const afterMonday = nextRecurringDueAt(task, new Date(2026, 9, 12, 10));
  assert.equal(new Date(afterMonday).getDay(), 3);
  assert.equal(new Date(afterMonday).getHours(), 9);
  const friday = { ...task, dueAt: new Date(2026, 9, 16, 9, 30).toISOString() };
  const nextWeekMonday = nextRecurringDueAt(friday, new Date(2026, 9, 16, 10));
  assert.equal(new Date(nextWeekMonday).toDateString(), new Date(2026, 9, 19, 9, 30).toDateString());
});

test('daily series fills the rest of the calendar week when created', () => {
  const monday = createTask({
    title: 'Agua',
    description: '',
    dueAt: new Date(2026, 9, 12, 8).toISOString(),
    hasTime: true,
    repeatEvery: 1,
    repeatUnit: 'days',
  });
  assert.deepEqual(
    materializeSiblingDueAts(monday).map((due) => dayKey(new Date(due))),
    ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'],
  );
  const friday = createTask({
    title: 'Agua',
    description: '',
    dueAt: new Date(2026, 9, 16, 8).toISOString(),
    hasTime: true,
    repeatEvery: 1,
    repeatUnit: 'days',
  });
  assert.deepEqual(
    materializeSiblingDueAts(friday).map((due) => dayKey(new Date(due))),
    ['2026-10-17', '2026-10-18'],
  );
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

test('date sections start at today and put overdue tasks under Hoy', () => {
  const now = new Date(2026, 9, 9, 23, 30);
  const section = (year, month, day) => taskDateSection({ ...createTask(draft), dueAt: new Date(year, month, day, 12).toISOString() }, now);
  assert.equal(section(2026, 9, 8), 'Hoy');
  assert.equal(section(2026, 9, 9), 'Hoy');
  assert.equal(section(2026, 9, 10), 'Mañana');
  assert.match(section(2026, 9, 11), /11/);
  assert.equal(taskDateSection(createTask(draft), now), 'Sin fecha');
  assert.equal(taskDateSection({ ...createTask(draft), dueAt: new Date(2027, 0, 1).toISOString() }, new Date(2026, 11, 31)), 'Mañana');
});

test('section due meta shows only time for today and red overdue day labels', () => {
  const now = new Date(2026, 9, 9, 15, 0);
  const todayTimed = { ...createTask(draft), dueAt: new Date(2026, 9, 9, 18, 30).toISOString(), hasTime: true };
  const overdueTimed = { ...createTask(draft), dueAt: new Date(2026, 9, 9, 10, 15).toISOString(), hasTime: true };
  const yesterday = { ...createTask(draft), dueAt: new Date(2026, 9, 8, 9, 0).toISOString(), hasTime: true };
  const yesterdayAllDay = { ...createTask(draft), dueAt: new Date(2026, 9, 8).toISOString(), hasTime: false };
  assert.deepEqual(formatTaskDueInSection(todayTimed, now), { label: null, time: '18:30', emphasize: false });
  assert.deepEqual(formatTaskDueInSection(overdueTimed, now), { label: null, time: '10:15', emphasize: true });
  assert.deepEqual(formatTaskDueInSection(yesterday, now), { label: 'Ayer', time: '09:00', emphasize: true });
  assert.deepEqual(formatTaskDueInSection(yesterdayAllDay, now), { label: 'Ayer', time: null, emphasize: true });
});

test('completed tasks scheduled today stay above until the local day ends', () => {
  const now = new Date(2026, 11, 31, 23, 59);
  const completed = { ...createTask(draft), completed: true, dueAt: new Date(2026, 11, 31, 9).toISOString(), hasTime: true };
  assert.equal(staysInTaskSchedule(completed, now), true);
  assert.equal(staysInTaskSchedule(completed, new Date(2027, 0, 1)), false);
  assert.equal(staysInTaskSchedule({ ...completed, completed: false }, new Date(2027, 0, 1)), true);
  assert.equal(taskDateSection({ ...completed, completed: false }, new Date(2027, 0, 1)), 'Hoy');
  assert.equal(staysInTaskSchedule({ ...completed, hasTime: false }, now), true);
  assert.equal(staysInTaskSchedule({ ...completed, dueAt: null }, now), false);
  assert.equal(staysInTaskSchedule({ ...completed, dueAt: new Date(2027, 0, 1).toISOString() }, now), false);
});
