import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { createHabit, parseHabits, toggleHabitDay, type Habit } from '@/models/habit';

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('tareas.habits.v1').then((value) => {
      if (!active) return;
      setHabits(parseHabits(value));
      setReady(true);
    }).catch(() => { if (active) setError('No pudimos abrir tus hábitos. Volvé a abrir la app.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    writes.current = writes.current
      .then(() => AsyncStorage.setItem('tareas.habits.v1', JSON.stringify(habits)))
      .then(() => setError(null))
      .catch(() => setError('No pudimos guardar los cambios en este dispositivo.'));
  }, [habits, ready]);
  function addHabit(name: string, intervalDays: Habit['intervalDays']) {
    if (ready && name.trim()) setHabits((current) => [...current, createHabit(name, intervalDays)]);
  }
  function renameHabit(id: string, name: string) {
    if (name.trim()) setHabits((current) => current.map((habit) => habit.id === id ? { ...habit, name: name.trim() } : habit));
  }
  function toggleDay(id: string, key: string) {
    setHabits((current) => current.map((habit) => habit.id === id ? toggleHabitDay(habit, key) : habit));
  }
  return { habits, ready, error, addHabit, renameHabit, toggleDay };
}
