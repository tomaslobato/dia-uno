import { useData } from '@/data/data-provider';
import { createTaskList, DEFAULT_LIST_ID } from '@/models/task-list';
import { dayKey } from '@/models/habit';
import {
  activeOccurrenceDay,
  alignDueToWeekdays,
  createTask,
  isRecurringTask,
  withOccurrenceDelete,
  withOccurrenceToggle,
  type TaskDeleteScope,
  type TaskDraft,
} from '@/models/task';
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
      const repeatEndsAt = repeatEvery
        ? (clean.repeatEndsAt === undefined ? current?.repeatEndsAt ?? null : clean.repeatEndsAt)
        : null;
      mutate({
        entity: 'tasks',
        id,
        action: 'patch',
        patch: {
          ...clean,
          repeatEvery,
          repeatUnit,
          repeatWeekdays: repeatUnit === 'weeks' ? clean.repeatWeekdays ?? current?.repeatWeekdays ?? [] : [],
          repeatEndsAt,
          recurrenceId: repeatEvery ? current?.recurrenceId ?? current?.id ?? clean.recurrenceId ?? null : null,
          ...(repeatEvery ? {} : { completedOccurrences: [], excludedOccurrences: [] }),
        },
      });
      return;
    }
    const item = createTask(clean);
    mutate({ entity: 'tasks', id: item.id, action: 'create', item });
  }
  function toggleTask(id: string, occurrenceDay?: string) {
    const task = tasks.find((item) => item.id === id);
    if (!ready || !task) return;
    const day = occurrenceDay ?? activeOccurrenceDay(task) ?? (task.dueAt ? dayKey(new Date(task.dueAt)) : dayKey());
    mutate({ entity: 'tasks', id, action: 'patch', patch: withOccurrenceToggle(task, day) });
  }
  function toggleStar(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (ready && task) mutate({ entity: 'tasks', id, action: 'patch', patch: { starred: !task.starred } });
  }
  function deleteTask(id: string, options?: { scope?: TaskDeleteScope; day?: string }) {
    if (!ready) return;
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const scope = options?.scope ?? 'all';
    const day = options?.day ?? activeOccurrenceDay(task) ?? (task.dueAt ? dayKey(new Date(task.dueAt)) : dayKey());
    if (!isRecurringTask(task) || scope === 'all') {
      mutate({ entity: 'tasks', id, action: 'delete' });
      return;
    }
    const result = withOccurrenceDelete(task, day, scope);
    if (result.action === 'delete') mutate({ entity: 'tasks', id, action: 'delete' });
    else mutate({ entity: 'tasks', id, action: 'patch', patch: result.patch });
  }
  return { tasks, lists, addList, renameList, deleteList, ready, error, saveTask, toggleTask, toggleStar, deleteTask };
}
