import { StyleSheet, Text, View } from 'react-native';
import { memo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { AgendaDayButton } from '@/components/agenda-pager';
import { useSectionStyles } from '@/theme/appearance';
import { isAgendaTaskOverdue } from '@/models/agenda';
import type { Task } from '@/models/task';

type Props = { task: Task; day: string; detailed: boolean; now: Date; onEdit: () => void };
function AgendaTaskEntry({ task, day, detailed, now, onEdit }: Props) {
  const { styles, color, accent, soft } = useSectionStyles(makeStyles, 'tasks');
  const textColor = task.completed ? color('#80868b') : accent;
  const entryStyle = [styles.entry, detailed && styles.detailedEntry, { backgroundColor: task.completed ? color('#f3f6f4') : soft }];
  const content = <View pointerEvents="none">
    <View style={styles.heading}>
      {task.starred && <MaterialIcons testID={`agenda-entry-star-${task.id}`} name="star" size={detailed ? 16 : 11} style={styles.star} color={textColor} />}
      {task.repeatEvery !== null && <MaterialIcons testID={`agenda-entry-recurrence-${task.id}`} name="repeat" size={detailed ? 14 : 9} style={styles.star} color={textColor} />}
      <Text numberOfLines={detailed ? 2 : 1} ellipsizeMode="tail" style={[styles.name, detailed && styles.detailedName, { color: textColor }, task.completed && styles.completed]}>{task.title}</Text>
      {isAgendaTaskOverdue(task, now) && <View testID={`agenda-entry-overdue-${day}-${task.id}`} style={styles.overdueDot} />}
    </View>
    {detailed && task.hasTime && task.dueAt && <Text style={[styles.time, styles.detailedTime, { color: textColor }]}>{new Date(task.dueAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>}
  </View>;
  return detailed ? <AgendaDayButton testID={`agenda-entry-${task.id}`} accessibilityRole="button" accessibilityLabel={`Editar tarea: ${task.title}`} onPress={(event) => { event.stopPropagation(); onEdit(); }} style={entryStyle}>{content}</AgendaDayButton> : <View testID={`agenda-entry-${task.id}`} pointerEvents="none" style={entryStyle}>{content}</View>;
}
export default memo(AgendaTaskEntry, (previous, next) => previous.task === next.task && previous.day === next.day && previous.detailed === next.detailed && Math.floor(previous.now.getTime() / 60000) === Math.floor(next.now.getTime() / 60000));
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  entry: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 }, detailedEntry: { borderRadius: 8, padding: 12 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 }, star: { flexShrink: 0 },
  name: { flex: 1, minWidth: 0, fontFamily: 'Manrope-Medium', fontSize: 10, lineHeight: 14 }, detailedName: { fontSize: 15, lineHeight: 21 },
  completed: { textDecorationLine: 'line-through' }, time: { fontFamily: 'Manrope-Regular', fontSize: 10, lineHeight: 13, marginTop: 1 },
  detailedTime: { fontSize: 12, lineHeight: 16, marginTop: 5 },
  overdueDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color('#e53935'), marginTop: 6, flexShrink: 0 },
});
