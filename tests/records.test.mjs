import assert from 'node:assert/strict';
import test from 'node:test';
import { createTask, withOccurrenceDelete, withOccurrenceToggle } from '../src/models/task.ts';
import { decodeRecords, encodeMutation, taskFields } from '../src/data/records.ts';

const owner = 'user-1';

test('recurring completion and delete patches encode the fields the account sync expects', () => {
  const task = createTask({
    title: 'Agua',
    description: '',
    dueAt: new Date(2026, 9, 23, 8).toISOString(),
    hasTime: true,
    repeatEvery: 1,
    repeatUnit: 'days',
  });
  const completed = withOccurrenceToggle(task, '2026-10-23');
  assert.deepEqual(taskFields(completed), { ocurrencias_completadas: ['2026-10-23'] });
  const excluded = withOccurrenceDelete(task, '2026-10-25', 'this');
  assert.equal(excluded.action, 'patch');
  assert.deepEqual(taskFields(excluded.patch), {
    ocurrencias_excluidas: ['2026-10-25'],
    ocurrencias_completadas: [],
  });
  const future = withOccurrenceDelete(task, '2026-10-25', 'future');
  assert.equal(future.action, 'patch');
  assert.deepEqual(taskFields(future.patch), {
    repetir_hasta: '2026-10-24',
    ocurrencias_completadas: [],
    ocurrencias_excluidas: [],
  });
  const create = encodeMutation({
    mutationId: 'm1',
    entity: 'tasks',
    id: task.id,
    action: 'create',
    item: task,
  });
  assert.equal(create.campos.repetir_cada, 1);
  assert.equal(create.campos.repetir_unidad, 'days');
  assert.deepEqual(create.campos.ocurrencias_completadas, []);
  assert.deepEqual(create.campos.ocurrencias_excluidas, []);
  assert.equal(create.campos.repetir_hasta, null);
});

test('remote task rows round-trip recurrence history into the local model', () => {
  const created = '2026-10-23T12:00:00.000Z';
  const records = decodeRecords({
    listas: [],
    habitos: [],
    tareas: [{
      usuario_id: owner,
      id: 'task-1',
      lista_id: null,
      nombre: 'Agua',
      descripcion: '',
      fecha: '2026-10-23',
      hora: '08:00:00',
      favorita: false,
      realizada: false,
      creada_en: created,
      repetir_cada: 1,
      repetir_unidad: 'days',
      recurrencia_id: 'task-1',
      repetir_dias: [],
      repetir_hasta: '2026-12-31',
      ocurrencias_completadas: ['2026-10-23', '2026-10-24'],
      ocurrencias_excluidas: ['2026-10-25'],
      recordatorio_minutos: 30,
    }],
  }, owner);
  assert.equal(records.tasks.length, 1);
  const task = records.tasks[0];
  assert.equal(task.repeatEvery, 1);
  assert.equal(task.repeatUnit, 'days');
  assert.equal(task.repeatEndsAt, '2026-12-31');
  assert.deepEqual(task.completedOccurrences, ['2026-10-23', '2026-10-24']);
  assert.deepEqual(task.excludedOccurrences, ['2026-10-25']);
});
