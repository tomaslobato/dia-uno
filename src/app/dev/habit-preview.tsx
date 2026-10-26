import { Redirect } from 'expo-router';
import { useState } from 'react';
import StreakLossNotice from '@/components/streak-loss-notice';
import { DEFAULT_HABIT_COLOR } from '@/constants/habit-colors';
import { DEFAULT_HABIT_ICON } from '@/constants/habit-icons';
import { dayKey, type Habit } from '@/models/habit';

export default function HabitPreview() {
  const [habit] = useState<Habit>(() => {
    const ago = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return dayKey(date); };
    return {
      id: 'preview-only',
      name: 'Leer un poco cada día',
      description: '',
      intervalDays: 1,
      createdOn: ago(100),
      completedDays: [100, 99, 80, 60, 40, 20, 5, 4, 3].map(ago),
      symbol: { type: 'icon', name: DEFAULT_HABIT_ICON },
      color: DEFAULT_HABIT_COLOR,
      kind: 'build',
      reminderTime: null,
      goal: null,
      streakEnabled: true,
    };
  });
  if (!__DEV__) return <Redirect href="/" />;
  return <StreakLossNotice owner="preview-only" previewHabit={habit} />;
}
