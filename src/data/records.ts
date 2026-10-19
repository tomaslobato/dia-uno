import { parseTaskLists, DEFAULT_LIST_ID, normalizeTaskListId, type TaskList } from '../models/task-list.ts';
import { parseTasks, type Task } from '../models/task.ts';
import { parseHabits, dayKey, type Habit } from '../models/habit.ts';
import type { Mutation, Records } from './types';

export function applyMutation(records: Records, mutation: Mutation): Records {
  if (mutation.entity === 'lists') {
    const lists = records.lists ?? [];
    if ((mutation.action === 'create' || mutation.action === 'import') && mutation.item && !lists.some((list) => list.id === mutation.id)) return { ...records, lists: [...lists, mutation.item as TaskList] };
    if (mutation.action === 'patch') return { ...records, lists: lists.map((list) => list.id === mutation.id ? { ...list, name: (mutation.patch as Partial<TaskList>)?.name ?? list.name } : list) };
    if (mutation.action === 'delete') return { ...records, lists: lists.filter((list) => list.id !== mutation.id), tasks: records.tasks.map((task) => task.listId === mutation.id ? { ...task, listId: null } : task) };
    return records;
  }
  if (mutation.entity === 'tasks') {
    let tasks = records.tasks;
    if ((mutation.action === 'create' || mutation.action === 'import') && mutation.item) {
      if (!tasks.some((task) => task.id === mutation.id)) tasks = [...tasks, mutation.item as Task];
    } else if (mutation.action === 'patch') {
      tasks = tasks.map((task) => task.id === mutation.id ? { ...task, ...mutation.patch, listId: mutation.patch && 'listId' in mutation.patch ? normalizeTaskListId(mutation.patch.listId) : task.listId, id: task.id } as Task : task);
    } else if (mutation.action === 'delete') tasks = tasks.filter((task) => task.id !== mutation.id);
    return { ...records, tasks };
  }
  if (mutation.entity !== 'habits') return records;
  let habits = records.habits;
  if ((mutation.action === 'create' || mutation.action === 'import') && mutation.item) {
    if (!habits.some((habit) => habit.id === mutation.id)) habits = [...habits, mutation.item as Habit];
  } else if (mutation.action === 'patch') {
    habits = habits.map((habit) => habit.id === mutation.id ? { ...habit, ...mutation.patch, id: habit.id } as Habit : habit);
  } else if (mutation.action === 'delete') habits = habits.filter((habit) => habit.id !== mutation.id);
  else if (mutation.action === 'day' && mutation.day) {
    const day = mutation.day;
    habits = habits.map((habit) => habit.id === mutation.id ? { ...habit, completedDays: mutation.done
      ? [...new Set([...habit.completedDays, day])].sort() : habit.completedDays.filter((key) => key !== day) } : habit);
  }
  return { ...records, habits };
}
export function projectRecords(base: Records, pending: Mutation[]) {
  return pending.reduce(applyMutation, base);
}

export function taskFields(task: Partial<Task>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if ('listId' in task) fields.lista_id = normalizeTaskListId(task.listId);
  if ('title' in task) fields.nombre = task.title;
  if ('description' in task) fields.descripcion = task.description;
  if ('completed' in task) fields.realizada = task.completed;
  if ('starred' in task) fields.favorita = task.starred;
  if ('repeatEvery' in task) fields.repetir_cada = task.repeatEvery;
  if ('repeatUnit' in task) fields.repetir_unidad = task.repeatUnit;
  if ('recurrenceId' in task) fields.recurrencia_id = task.recurrenceId;
  if ('reminderMinutes' in task) fields.recordatorio_minutos = task.reminderMinutes;
  if ('createdAt' in task) fields.creada_en = task.createdAt;
  if ('dueAt' in task) {
    const date = task.dueAt ? new Date(task.dueAt) : null;
    fields.fecha = date ? dayKey(date) : null;
    fields.hora = date && task.hasTime ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00` : null;
  }
  return fields;
}
export function habitFields(habit: Partial<Habit>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if ('name' in habit) fields.nombre = habit.name;
  if ('description' in habit) fields.descripcion = habit.description;
  if ('intervalDays' in habit) fields.dias = habit.intervalDays;
  if ('completedDays' in habit) fields.dias_completados = habit.completedDays;
  if ('createdOn' in habit) fields.creado_el = habit.createdOn;
  return fields;
}
export function encodeMutation(mutation: Mutation) {
  const item = mutation.item ?? mutation.patch ?? {};
  return {
    cambio_id: mutation.mutationId, entidad: ({ tasks: 'tareas', habits: 'habitos', lists: 'listas' } as const)[mutation.entity],
    id: mutation.id, accion: ({ create: 'crear', import: 'importar', patch: 'editar', delete: 'eliminar', day: 'dia' } as const)[mutation.action],
    campos: mutation.entity === 'lists' ? { nombre: (item as TaskList).name, creada_en: (item as TaskList).createdAt } : mutation.entity === 'tasks' ? taskFields(item as Partial<Task>) : habitFields(item as Partial<Habit>),
    ...(mutation.action === 'day' ? { dia: mutation.day, completado: mutation.done } : {}),
  };
}

export function decodeRecords(value: unknown, owner: string): Records {
  if (!value || typeof value !== 'object') throw new Error('Respuesta de datos inválida');
  const rows = value as { tareas?: unknown; habitos?: unknown; listas?: unknown };
  if (!Array.isArray(rows.tareas) || !Array.isArray(rows.habitos)) throw new Error('Respuesta de datos inválida');
  const taskRows: Task[] = rows.tareas.map((row) => {
    if (!row || row.usuario_id !== owner) throw new Error('Propietario de datos inválido');
    if (row.fecha !== null && (typeof row.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.fecha))) throw new Error('Fecha inválida');
    if (row.hora !== null && (typeof row.hora !== 'string' || !/^\d{2}:\d{2}:\d{2}/.test(row.hora) || row.fecha === null)) throw new Error('Hora inválida');
    const due = row.fecha === null ? null : new Date(`${row.fecha}T${row.hora ?? '00:00:00'}`);
    if (due && (!Number.isFinite(due.getTime()) || dayKey(due) !== row.fecha)) throw new Error('Fecha inválida');
    return { id: row.id, listId: normalizeTaskListId(row.lista_id), title: row.nombre, description: row.descripcion, dueAt: due?.toISOString() ?? null,
      hasTime: row.hora !== null, starred: row.favorita, completed: row.realizada, createdAt: row.creada_en,
      repeatEvery: row.repetir_cada ?? null, repeatUnit: row.repetir_unidad ?? null, recurrenceId: row.recurrencia_id ?? null,
      reminderMinutes: row.recordatorio_minutos === undefined ? 30 : row.recordatorio_minutos };
  });
  const habitRows: Habit[] = rows.habitos.map((row) => {
    if (!row || row.usuario_id !== owner) throw new Error('Propietario de datos inválido');
    return { id: row.id, name: row.nombre, description: row.descripcion, intervalDays: Number(row.dias), createdOn: row.creado_el, completedDays: row.dias_completados };
  });
  const lists = rows.listas === undefined ? [] : parseTaskLists((rows.listas as { usuario_id: string; id: string; nombre: string; creada_en: string }[]).map((row) => {
    if (!row || row.usuario_id !== owner) throw new Error('Propietario de lista inválido');
    return { id: row.id, name: row.nombre, createdAt: row.creada_en };
  })).filter((list) => list.id !== DEFAULT_LIST_ID);
  return { lists, tasks: parseTasks(JSON.stringify(taskRows)), habits: parseHabits(JSON.stringify(habitRows)) };
}
