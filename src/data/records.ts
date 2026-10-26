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
  if ('repeatEvery' in task || 'repeatUnit' in task) {
    // Remote schema only allows days/weeks/months; years are sent as months.
    const unit = task.repeatUnit ?? null;
    const every = task.repeatEvery ?? null;
    if (unit === 'years' && every) {
      fields.repetir_cada = every * 12;
      fields.repetir_unidad = 'months';
    } else {
      if ('repeatEvery' in task) fields.repetir_cada = every;
      if ('repeatUnit' in task) fields.repetir_unidad = unit;
    }
  }
  if ('recurrenceId' in task) fields.recurrencia_id = task.recurrenceId;
  if ('repeatWeekdays' in task) fields.repetir_dias = task.repeatWeekdays ?? [];
  if ('repeatEndsAt' in task) fields.repetir_hasta = task.repeatEndsAt;
  if ('completedOccurrences' in task) fields.ocurrencias_completadas = task.completedOccurrences ?? [];
  if ('excludedOccurrences' in task) fields.ocurrencias_excluidas = task.excludedOccurrences ?? [];
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
  if ('symbol' in habit && habit.symbol) {
    fields.simbolo_tipo = habit.symbol.type;
    fields.simbolo_valor = habit.symbol.type === 'emoji' ? habit.symbol.value : habit.symbol.name;
  }
  if ('color' in habit) fields.color = habit.color;
  if ('kind' in habit) fields.tipo = habit.kind;
  if ('reminderTime' in habit) fields.recordatorio_hora = habit.reminderTime;
  if ('goal' in habit) {
    fields.meta_cantidad = habit.goal?.count ?? null;
    fields.meta_periodo = habit.goal?.period ?? null;
  }
  if ('streakEnabled' in habit) fields.racha = habit.streakEnabled;
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

function dayKeyFromRemote(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function dayKeysFromRemote(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(dayKeyFromRemote).filter((day): day is string => Boolean(day));
}

export function decodeRecords(value: unknown, owner: string): Records {
  if (!value || typeof value !== 'object') throw new Error('Respuesta de datos inválida');
  const rows = value as { tareas?: unknown; habitos?: unknown; listas?: unknown };
  if (!Array.isArray(rows.tareas) || !Array.isArray(rows.habitos)) throw new Error('Respuesta de datos inválida');
  const taskRows = rows.tareas.map((row) => {
    if (!row || row.usuario_id !== owner) throw new Error('Propietario de datos inválido');
    if (row.fecha !== null && (typeof row.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.fecha))) throw new Error('Fecha inválida');
    if (row.hora !== null && (typeof row.hora !== 'string' || !/^\d{2}:\d{2}:\d{2}/.test(row.hora) || row.fecha === null)) throw new Error('Hora inválida');
    const due = row.fecha === null ? null : new Date(`${row.fecha}T${row.hora ?? '00:00:00'}`);
    if (due && (!Number.isFinite(due.getTime()) || dayKey(due) !== row.fecha)) throw new Error('Fecha inválida');
    return { id: row.id, listId: normalizeTaskListId(row.lista_id), title: row.nombre, description: row.descripcion, dueAt: due?.toISOString() ?? null,
      hasTime: row.hora !== null, starred: row.favorita, completed: row.realizada, createdAt: row.creada_en,
      repeatEvery: row.repetir_cada ?? null, repeatUnit: row.repetir_unidad ?? null, recurrenceId: row.recurrencia_id ?? null,
      repeatWeekdays: Array.isArray(row.repetir_dias) ? row.repetir_dias : undefined,
      repeatEndsAt: dayKeyFromRemote(row.repetir_hasta),
      completedOccurrences: dayKeysFromRemote(row.ocurrencias_completadas) ?? [],
      excludedOccurrences: dayKeysFromRemote(row.ocurrencias_excluidas) ?? [],
      reminderMinutes: row.recordatorio_minutos === undefined ? 30 : row.recordatorio_minutos };
  });
  const habitRows = rows.habitos.map((row) => {
    if (!row || row.usuario_id !== owner) throw new Error('Propietario de datos inválido');
    const symbolType = row.simbolo_tipo === 'emoji' ? 'emoji' : 'icon';
    const symbolValue = typeof row.simbolo_valor === 'string' ? row.simbolo_valor : undefined;
    const goalCount = row.meta_cantidad == null ? null : Number(row.meta_cantidad);
    const goalPeriod = row.meta_periodo === 'day' || row.meta_periodo === 'week' || row.meta_periodo === 'month' ? row.meta_periodo : null;
    const reminder = row.recordatorio_hora == null ? null : String(row.recordatorio_hora).slice(0, 5);
    return {
      id: row.id,
      name: row.nombre,
      description: row.descripcion,
      intervalDays: Number(row.dias),
      createdOn: row.creado_el,
      completedDays: row.dias_completados,
      symbol: symbolValue
        ? (symbolType === 'emoji' ? { type: 'emoji', value: symbolValue } : { type: 'icon', name: symbolValue })
        : undefined,
      color: row.color,
      kind: row.tipo,
      reminderTime: reminder,
      goal: goalCount && goalPeriod ? { count: goalCount, period: goalPeriod } : null,
      streakEnabled: row.racha === undefined ? true : Boolean(row.racha),
    };
  });
  const lists = rows.listas === undefined ? [] : parseTaskLists((rows.listas as { usuario_id: string; id: string; nombre: string; creada_en: string }[]).map((row) => {
    if (!row || row.usuario_id !== owner) throw new Error('Propietario de lista inválido');
    return { id: row.id, name: row.nombre, createdAt: row.creada_en };
  })).filter((list) => list.id !== DEFAULT_LIST_ID);
  return { lists, tasks: parseTasks(JSON.stringify(taskRows)), habits: parseHabits(JSON.stringify(habitRows)) };
}
