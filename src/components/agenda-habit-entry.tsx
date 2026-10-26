import { MaterialIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AgendaDayButton } from '@/components/agenda-pager';
import HabitSymbolView from '@/components/habit-symbol';
import { useSectionStyles } from '@/theme/appearance';
import { habitStreak, type Habit } from '@/models/habit';

type Props = { habit: Habit; day: string; today: string; detailed: boolean; onEdit: () => void };

function AgendaHabitEntry({ habit, day, today, detailed, onEdit }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'habits');
  const past = day < today;
  const accent = habit.color;
  const entryColor = past ? color('#80868b') : accent;
  const muted = past ? color('#9aa0a6') : color('#5f6368');
  const background = past ? color('#f3f6f4') : `${accent}18`;
  const completed = habit.completedDays.includes(day);
  const streak = habit.streakEnabled ? habitStreak(habit, day > today ? today : day) : 0;
  const intervalLabel = habit.intervalDays === 1 ? 'Cada día' : `Cada ${habit.intervalDays} días`;
  const content = (
    <View pointerEvents="none">
      <View style={styles.heading}>
        {detailed && <HabitSymbolView symbol={habit.symbol} color={entryColor} size={16} style={styles.symbol} />}
        <Text numberOfLines={detailed ? 2 : 1} style={[styles.name, detailed && styles.detailedName, { color: entryColor }, completed && !past && styles.completed]}>
          {completed && !past ? '✓ ' : ''}{habit.name}
        </Text>
        {past
          ? (completed && <MaterialIcons testID={`agenda-habit-completed-${day}-${habit.id}`} name="local-fire-department" size={detailed ? 18 : 12} color={entryColor} />)
          : habit.streakEnabled
            ? <Text testID={`agenda-habit-streak-${day}-${habit.id}`} style={[styles.streakText, detailed && styles.detailedStreak, { color: entryColor }]}>{streak > 0 ? '🔥' : '🧊'} {streak}</Text>
            : null}
      </View>
      {detailed && Boolean(habit.description) && <Text numberOfLines={2} style={[styles.description, { color: muted }]}>{habit.description}</Text>}
      {detailed && (
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <MaterialIcons name="replay" size={13} color={muted} />
            <Text style={[styles.metaText, { color: muted }]}>{intervalLabel}</Text>
          </View>
          <Text style={[styles.metaText, { color: muted }]}>{completed ? 'Hecho' : past ? 'Pendiente' : 'Por hacer'}</Text>
        </View>
      )}
    </View>
  );
  const label = `Hábito: ${habit.name}, ${completed ? 'completado' : 'pendiente'}${past || !habit.streakEnabled ? '' : `, racha de ${streak}`}`;
  const entryStyle = [styles.entry, detailed && styles.detailedEntry, { backgroundColor: background }];
  return detailed
    ? <AgendaDayButton testID={`agenda-habit-${day}-${habit.id}`} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Abrir el historial y editar este hábito" onPress={(event) => { event.stopPropagation(); onEdit(); }} style={entryStyle}>{content}</AgendaDayButton>
    : <View testID={`agenda-habit-${day}-${habit.id}`} accessible accessibilityLabel={label} pointerEvents="none" style={entryStyle}>{content}</View>;
}

export default memo(AgendaHabitEntry, (previous, next) => previous.habit === next.habit && previous.day === next.day && previous.today === next.today && previous.detailed === next.detailed);

const makeStyles = (_color: (value: string) => string) => StyleSheet.create({
  entry: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 },
  detailedEntry: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, gap: 4 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
  symbol: { marginTop: 2, marginRight: 2 },
  name: { flex: 1, minWidth: 0, fontFamily: 'Manrope-Medium', fontSize: 10, lineHeight: 14 },
  detailedName: { fontSize: 15, lineHeight: 21 },
  completed: { textDecorationLine: 'line-through' },
  streakText: { flexShrink: 0, fontFamily: 'Manrope-Medium', fontSize: 9, lineHeight: 14 },
  detailedStreak: { fontSize: 12, lineHeight: 21 },
  description: { fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 17 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontFamily: 'Manrope-Medium', fontSize: 11, lineHeight: 14 },
});
