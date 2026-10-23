import { StyleSheet, Text, View } from 'react-native';
import { memo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { AgendaDayButton } from '@/components/agenda-pager';
import { useSectionStyles } from '@/theme/appearance';
import { isAgendaTaskOverdue } from '@/models/agenda';
import { formatTaskRepeat, type Task } from '@/models/task';

type Props = { task: Task; day: string; detailed: boolean; now: Date; listName?: string; onEdit: () => void };

function AgendaTaskEntry({ task, day, detailed, now, listName, onEdit }: Props) {
  const { styles, color, accent, soft } = useSectionStyles(makeStyles, 'tasks');
  const overdue = isAgendaTaskOverdue(task, now);
  const textColor = task.completed ? color('#80868b') : accent;
  const muted = task.completed ? color('#9aa0a6') : color('#5f6368');
  const entryStyle = [styles.entry, detailed && styles.detailedEntry, { backgroundColor: task.completed ? color('#f3f6f4') : soft }];
  const timeLabel = task.hasTime && task.dueAt
    ? new Date(task.dueAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;
  const repeatLabel = detailed ? formatTaskRepeat(task) : null;
  const showMeta = detailed && (timeLabel || listName || repeatLabel || (overdue && !task.completed));
  const content = (
    <View pointerEvents="none">
      <View style={styles.heading}>
        {task.starred && <MaterialIcons testID={`agenda-entry-star-${task.id}`} name="star" size={detailed ? 16 : 11} style={styles.star} color={textColor} />}
        <Text numberOfLines={detailed ? 2 : 1} ellipsizeMode="tail" style={[styles.name, detailed && styles.detailedName, { color: textColor }, task.completed && styles.completed]}>{task.title}</Text>
        {overdue && <View testID={`agenda-entry-overdue-${day}-${task.id}`} style={styles.overdueDot} />}
      </View>
      {detailed && Boolean(task.description.trim()) && (
        <Text numberOfLines={1} style={[styles.description, { color: muted }]}>{task.description.trim()}</Text>
      )}
      {showMeta && (
        <View style={styles.meta}>
          {timeLabel && (
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={13} color={muted} />
              <Text style={[styles.metaText, { color: muted }]}>{timeLabel}</Text>
            </View>
          )}
          {repeatLabel && (
            <View style={styles.metaItem}>
              <MaterialIcons testID={`agenda-entry-recurrence-${task.id}`} name="repeat" size={13} color={muted} />
              <Text numberOfLines={1} style={[styles.metaText, styles.metaList, { color: muted }]}>{repeatLabel}</Text>
            </View>
          )}
          {listName ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="label-outline" size={13} color={muted} />
              <Text numberOfLines={1} style={[styles.metaText, styles.metaList, { color: muted }]}>{listName}</Text>
            </View>
          ) : null}
          {overdue && !task.completed && <Text style={styles.overdueLabel}>Atrasada</Text>}
        </View>
      )}
      {!detailed && timeLabel && <Text style={[styles.time, { color: textColor }]}>{timeLabel}</Text>}
    </View>
  );
  return detailed
    ? <AgendaDayButton testID={`agenda-entry-${task.id}`} accessibilityRole="button" accessibilityLabel={`Editar tarea: ${task.title}`} onPress={(event) => { event.stopPropagation(); onEdit(); }} style={entryStyle}>{content}</AgendaDayButton>
    : <View testID={`agenda-entry-${task.id}`} pointerEvents="none" style={entryStyle}>{content}</View>;
}

export default memo(AgendaTaskEntry, (previous, next) => (
  previous.task === next.task
  && previous.day === next.day
  && previous.detailed === next.detailed
  && previous.listName === next.listName
  && Math.floor(previous.now.getTime() / 60000) === Math.floor(next.now.getTime() / 60000)
));

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  entry: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 },
  detailedEntry: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, gap: 4 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
  star: { flexShrink: 0, marginTop: 2 },
  name: { flex: 1, minWidth: 0, fontFamily: 'Manrope-Medium', fontSize: 10, lineHeight: 14 },
  detailedName: { fontSize: 15, lineHeight: 21 },
  completed: { textDecorationLine: 'line-through' },
  description: { fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 17 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  metaText: { fontFamily: 'Manrope-Medium', fontSize: 11, lineHeight: 14 },
  metaList: { flexShrink: 1 },
  overdueLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 11, lineHeight: 14, color: color('#e53935') },
  time: { fontFamily: 'Manrope-Regular', fontSize: 10, lineHeight: 13, marginTop: 1 },
  overdueDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color('#e53935'), marginTop: 6, flexShrink: 0 },
});
