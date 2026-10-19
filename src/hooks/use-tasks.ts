import { useData } from '@/data/data-provider';
import { createTaskList, DEFAULT_LIST_ID } from '@/models/task-list';
import { createTask, nextRecurringDueAt, type TaskDraft } from '@/models/task';

export function useTasks() {
  const { tasks, lists: storedLists, ready, error, mutate } = useData();
  const lists = (storedLists ?? []).filter((list) => list.id !== DEFAULT_LIST_ID);
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
    const clean = { ...draft, title: draft.title.trim(), description: draft.description.trim() };
    if (id) {
      const current = tasks.find((task) => task.id === id);
      const repeatEvery = clean.repeatEvery === undefined ? current?.repeatEvery ?? null : clean.repeatEvery;
      mutate({ entity: 'tasks', id, action: 'patch', patch: { ...clean, repeatEvery, repeatUnit: repeatEvery ? clean.repeatUnit ?? current?.repeatUnit ?? 'days' : null, recurrenceId: repeatEvery ? current?.recurrenceId ?? current?.id ?? clean.recurrenceId ?? null : null } });
    }
    else { const item = createTask(clean); mutate({ entity: 'tasks', id: item.id, action: 'create', item }); }
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
    const next = createTask({ listId: task.listId, title: task.title, description: task.description, dueAt, hasTime: task.hasTime, repeatEvery: task.repeatEvery, repeatUnit: task.repeatUnit, recurrenceId });
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
