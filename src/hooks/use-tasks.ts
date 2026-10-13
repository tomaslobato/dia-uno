import { useData } from '@/data/data-provider';
import { createTaskList, DEFAULT_LIST_ID } from '@/models/task-list';
import { createTask, type TaskDraft } from '@/models/task';

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
    if (id) mutate({ entity: 'tasks', id, action: 'patch', patch: clean });
    else { const item = createTask(clean); mutate({ entity: 'tasks', id: item.id, action: 'create', item }); }
  }
  function toggleTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (ready && task) mutate({ entity: 'tasks', id, action: 'patch', patch: { completed: !task.completed } });
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
