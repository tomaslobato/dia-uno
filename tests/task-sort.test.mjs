import assert from 'node:assert/strict';
import test from 'node:test';
import { createTask, mergeOrderWithTasks, sortTasksByOrder } from '../src/models/task.ts';

const early = { ...createTask({ title: 'Temprana', description: '', dueAt: new Date(2026, 9, 20).toISOString(), hasTime: false }), id: 'early' };
const late = { ...createTask({ title: 'Tarde', description: '', dueAt: new Date(2026, 9, 22).toISOString(), hasTime: false }), id: 'late' };
const middle = { ...createTask({ title: 'Media', description: '', dueAt: new Date(2026, 9, 21).toISOString(), hasTime: false }), id: 'middle' };

test('manual order keeps the saved sequence and appends new tasks by date', () => {
  const ordered = sortTasksByOrder([late, early, middle], ['middle', 'early']);
  assert.deepEqual(ordered.map((task) => task.id), ['middle', 'early', 'late']);
  assert.deepEqual(mergeOrderWithTasks(['early'], [late, early, middle]), ['early', 'middle', 'late']);
});
