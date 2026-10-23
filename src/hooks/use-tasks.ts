import { useData } from '@/data/data-provider';
import { createTaskList, DEFAULT_LIST_ID } from '@/models/task-list';
import { dayKey } from '@/models/habit';
import { alignDueToWeekdays, createTask, materializeSiblingDueAts, nextRecurringDueAt, type TaskDraft } from '@/models/task';
import { useMemo } from 'react';

export function useTasks() {
  const { tasks, lists: storedLists, ready, error, mutate } = useData();
  const lists = useMemo(() => (storedLists ?? []).filter((list) => list.id !== DEFAULT_LIST_ID), [storedLists]);
  function addList(name: string) {
    if (!ready || !name.trim() || name.trim().length > 16) return null;
    const item = createTaskList(name);
    mutate({ entity: 'lists', id: item.id, action: 'create', item });
    return item.id;
  }
  function renameList(id: string, name: string) {
    if (ready && name.trim() && name.trim().length <= 16) mutate({ entity: 'lists', id, action: 'patch', patch: { name: name.trim() } });
  }
  function deleteList(id: string) {
    if (ready) mutate({ entity: 'lists', id, action: 'delete' });
  }
  function saveTask(draft: TaskDraft, id?: string) {
    if (!draft.title.trim() || !ready) return;
    let clean: TaskDraft = { ...draft, title: draft.title.trim(), description: draft.description.trim() };
    if (clean.dueAt && clean.repeatEvery && clean.repeatUnit === 'weeks' && clean.repeatWeekdays?.length) {
      const aligned = alignDueToWeekdays(new Date(clean.dueAt), clean.repeatWeekdays);
      clean = { ...clean, dueAt: aligned.toISOString() };
    }
    if (id) {
      const current = tasks.find((task) => task.id === id);
      const repeatEvery = clean.repeatEvery === undefined ? current?.repeatEvery ?? null : clean.repeatEvery;
      const repeatUnit = repeatEvery ? clean.repeatUnit ?? current?.repeatUnit ?? 'days' : null;
      mutate({
        entity: 'tasks',
        id,
        action: 'patch',
        patch: {
          ...clean,
          repeatEvery,
          repeatUnit,
          repeatWeekdays: repeatUnit === 'weeks' ? clean.repeatWeekdays ?? current?.repeatWeekdays ?? [] : [],
          recurrenceId: repeatEvery ? current?.recurrenceId ?? current?.id ?? clean.recurrenceId ?? null : null,
        },
      });
      return;
    }
    const item = createTask(clean);
    const siblings = materializeSiblingDueAts(item).map((dueAt, index) => createTask({
      listId: item.listId,
      title: item.title,
      description: item.description,
      dueAt,
      hasTime: item.hasTime,
      starred: item.starred,
      repeatEvery: item.repeatEvery,
      repeatUnit: item.repeatUnit,
      repeatWeekdays: item.repeatWeekdays,
      recurrenceId: item.recurrenceId,
      reminderMinutes: item.reminderMinutes,
    }, new Date(), `${item.recurrenceId}:day:${dayKey(new Date(dueAt))}:${index}`));
    // Enqueue root + siblings together so a mid-flight sync cannot drop later creates.
    for (const occurrence of [item, ...siblings]) {
      mutate({ entity: 'tasks', id: occurrence.id, action: 'create', item: occurrence });
    }
  }
  function toggleTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!ready || !task) return;
    const completing = !task.completed;
    mutate({ entity: 'tasks', id, action: 'patch', patch: { completed: completing } });
    if (!completing || !task.repeatEvery || !task.repeatUnit) return;
    const recurrenceId = task.recurrenceId ?? task.id;
    const root = tasks.find((item) => item.id === recurrenceId);
    const dueAt = nextRecurringDueAt(task, new Date(), root?.dueAt);
    if (!dueAt) return;
    if (tasks.some((item) => item.id !== task.id && item.recurrenceId === recurrenceId && !item.completed && item.dueAt === dueAt)) return;
    const next = createTask({
      listId: task.listId,
      title: task.title,
      description: task.description,
      dueAt,
      hasTime: task.hasTime,
      starred: task.starred,
      repeatEvery: task.repeatEvery,
      repeatUnit: task.repeatUnit,
      repeatWeekdays: task.repeatWeekdays,
      recurrenceId,
      reminderMinutes: task.reminderMinutes,
    });
    mutate({ entity: 'tasks', id: next.id, action: 'create', item: next });
  }
  function toggleStar(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (ready && task) mutate({ entity: 'tasks', id, action: 'patch', patch: { starred: !task.starred } });
  }
  function deleteTask(id: string) {
    if (ready) mutate({ entity: 'tasks', id, action: 'delete' });
  }
  return { tasks, lists, addList, renameList, deleteList, ready, error, saveTask, toggleTask, toggleStar, deleteTask };
}
