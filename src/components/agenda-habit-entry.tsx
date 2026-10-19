import { MaterialIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AgendaDayButton } from '@/components/agenda-pager';
import { useSectionStyles } from '@/theme/appearance';
import { habitStreak, type Habit } from '@/models/habit';

type Props = { habit: Habit; day: string; today: string; detailed: boolean; onEdit: () => void };
function AgendaHabitEntry({ habit, day, today, detailed, onEdit }: Props) {
  const { styles, color, accent, soft } = useSectionStyles(makeStyles, 'habits');
  const past = day < today;
  const entryColor = past ? color('#80868b') : accent;
  const background = past ? color('#f3f6f4') : soft;
  const completed = habit.completedDays.includes(day);
  const streak = habitStreak(habit, day > today ? today : day);
  const content = <View pointerEvents="none">
      <View style={styles.heading}>
        <Text numberOfLines={detailed ? 2 : 1} style={[styles.name, detailed && styles.detailedName, { color: entryColor }, completed && !past && styles.completed]}>{completed && !past ? '✓ ' : ''}{habit.name}</Text>
        {past ? (completed && <MaterialIcons testID={`agenda-habit-completed-${day}-${habit.id}`} name="local-fire-department" size={detailed ? 18 : 12} color={entryColor} />) : <Text testID={`agenda-habit-streak-${day}-${habit.id}`} style={[styles.streakText, detailed && styles.detailedStreak, { color: entryColor }]}>{streak > 0 ? '🔥' : '🧊'} {streak}</Text>}
      </View>
      {detailed && Boolean(habit.description) && <Text numberOfLines={1} style={[styles.description, { color: entryColor }]}>{habit.description}</Text>}
  </View>;
  const label = `Hábito: ${habit.name}, ${completed ? 'completado' : 'pendiente'}${past ? '' : `, racha de ${streak}`}`;
  const entryStyle = [styles.entry, detailed && styles.detailedEntry, { backgroundColor: background }];
  return detailed ? <AgendaDayButton testID={`agenda-habit-${day}-${habit.id}`} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Abrir el historial y editar este hábito" onPress={(event) => { event.stopPropagation(); onEdit(); }} style={entryStyle}>{content}</AgendaDayButton> : <View testID={`agenda-habit-${day}-${habit.id}`} accessible accessibilityLabel={label} pointerEvents="none" style={entryStyle}>{content}</View>;
}
export default memo(AgendaHabitEntry, (previous, next) => previous.habit === next.habit && previous.day === next.day && previous.today === next.today && previous.detailed === next.detailed);
const makeStyles = (_color: (value: string) => string) => StyleSheet.create({
  entry: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 }, detailedEntry: { borderRadius: 8, padding: 12 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 }, name: { flex: 1, minWidth: 0, fontFamily: 'Manrope-Medium', fontSize: 10, lineHeight: 14 }, detailedName: { fontSize: 15, lineHeight: 21 }, completed: { textDecorationLine: 'line-through' },
  streakText: { flexShrink: 0, fontFamily: 'Manrope-Medium', fontSize: 9, lineHeight: 14 }, detailedStreak: { fontSize: 12, lineHeight: 21 }, description: { fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 17, marginTop: 5 },
});
