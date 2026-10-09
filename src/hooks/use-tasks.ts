import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { createTask, parseTasks, type Task, type TaskDraft } from '@/models/task';

const STORAGE_KEY = 'tareas.tasks.v1';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!active) return;
        setTasks(parseTasks(value));
        setReady(true);
      })
      .catch(() => {
        if (active) setError('No pudimos abrir tus tareas. Cerrá y volvé a abrir la app.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Serialize writes so an earlier save cannot overwrite a newer change.
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)))
      .then(() => setError(null))
      .catch(() => setError('No pudimos guardar los cambios en este dispositivo.'));
  }, [tasks, ready]);

  function saveTask(draft: TaskDraft, id?: string) {
    if (!draft.title.trim() || !ready) return;
    setTasks((current) => id
      ? current.map((task) => task.id === id
        ? { ...task, ...draft, title: draft.title.trim(), description: draft.description.trim() }
        : task)
      : [...current, createTask(draft)]);
  }

  function toggleTask(id: string) {
    setTasks((current) => current.map((task) => task.id === id
      ? { ...task, completed: !task.completed }
      : task));
  }

  function toggleStar(id: string) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, starred: !task.starred } : task));
  }

  function deleteTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  return { tasks, ready, error, saveTask, toggleTask, toggleStar, deleteTask };
}
