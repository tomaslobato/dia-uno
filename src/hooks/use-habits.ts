import { useData } from '@/data/data-provider';
import { createHabit, toggleHabitDay, type Habit } from '@/models/habit';

export function useHabits() {
  const { habits, ready, error, mutate } = useData();
  function addHabit(name: string, intervalDays: Habit['intervalDays'], description = '') {
    if (!ready || !name.trim()) return;
    const item = createHabit(name, intervalDays, new Date(), description);
    mutate({ entity: 'habits', id: item.id, action: 'create', item });
  }
  function updateHabit(id: string, name: string, intervalDays: number, description: string) {
    if (!ready || !name.trim() || !Number.isSafeInteger(intervalDays) || intervalDays < 1) return;
    mutate({ entity: 'habits', id, action: 'patch', patch: { name: name.trim(), description: description.trim(), intervalDays } });
  }
  function toggleDay(id: string, day: string) {
    const habit = habits.find((item) => item.id === id);
    if (!ready || !habit || toggleHabitDay(habit, day) === habit) return;
    mutate({ entity: 'habits', id, action: 'day', day, done: !habit.completedDays.includes(day) });
  }
  function deleteHabit(id: string) {
    if (ready) mutate({ entity: 'habits', id, action: 'delete' });
  }
  return { deleteHabit, habits, ready, error, addHabit, updateHabit, toggleDay };
}
