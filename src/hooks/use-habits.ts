import { useData } from '@/data/data-provider';
import { createHabit, toggleHabitDay, type HabitDraft } from '@/models/habit';

export function useHabits() {
  const { habits, ready, error, mutate } = useData();
  function addHabit(draft: HabitDraft) {
    if (!ready || !draft.name.trim()) return;
    const item = createHabit(draft);
    mutate({ entity: 'habits', id: item.id, action: 'create', item });
  }
  function updateHabit(id: string, draft: HabitDraft) {
    if (!ready || !draft.name.trim()) return;
    const intervalDays = Number.isSafeInteger(draft.intervalDays) && (draft.intervalDays as number) >= 1
      ? (draft.intervalDays as number)
      : 1;
    mutate({
      entity: 'habits',
      id,
      action: 'patch',
      patch: {
        name: draft.name.trim(),
        description: draft.description.trim(),
        intervalDays,
        symbol: draft.symbol,
        color: draft.color,
        kind: draft.kind,
        reminderTime: draft.reminderTime,
        goal: draft.goal,
        streakEnabled: draft.streakEnabled,
      },
    });
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
