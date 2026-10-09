import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { formatDueDate, isOverdue, type Task } from '@/models/task';

type Props = { task: Task; onToggle: () => void; onEdit: () => void; onStar: () => void; animateArrival?: boolean; last?: boolean };

export default function TaskRow({ task, onToggle, onEdit, onStar, animateArrival = false, last }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  const [entering, setEntering] = useState(animateArrival);
  const [presence] = useState(() => new Animated.Value(animateArrival ? 0 : 1));
  const [rowHeight, setRowHeight] = useState(0);
  const arrived = useRef(false);
  useEffect(() => {
    if (!entering || !rowHeight || arrived.current) return;
    arrived.current = true;
    const animation = Animated.timing(presence, { toValue: 1, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setEntering(false); });
    return () => animation.stop();
  }, [entering, rowHeight, presence]);
  const overdue = isOverdue(task);
  const [progress] = useState(() => new Animated.Value(task.completed ? 1 : 0));
  const [checkScale] = useState(() => new Animated.Value(1));
  const [transitioning, setTransitioning] = useState(false);
  const [lines, setLines] = useState<{ x: number; y: number; width: number; height: number }[]>([]);

  function toggleWithAnimation() {
    if (transitioning) return;
    setTransitioning(true);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: task.completed ? 0 : 1, duration: 180,
        easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(checkScale, { toValue: 1.2, duration: 70, useNativeDriver: false }),
        Animated.spring(checkScale, { toValue: 1, speed: 38, bounciness: 5, useNativeDriver: false }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) { setTransitioning(false); return; }
      Animated.timing(presence, { toValue: 0, duration: 160, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(({ finished: moved }) => {
        if (moved) onToggle();
        else { presence.setValue(1); setTransitioning(false); }
      });
    });
  }

  return (
    <Animated.View pointerEvents={transitioning ? 'none' : 'auto'} style={{ overflow: 'hidden', opacity: presence, height: rowHeight && (transitioning || entering) ? presence.interpolate({ inputRange: [0, 1], outputRange: [0, rowHeight] }) : undefined }}>
    <View onLayout={(event) => { if (!transitioning) setRowHeight(event.nativeEvent.layout.height); }} style={[styles.row, !last && styles.border, rowHeight && (transitioning || entering) ? { height: rowHeight, flexShrink: 0 } : undefined]}>
      <Pressable onPress={toggleWithAnimation} disabled={transitioning} accessibilityRole="checkbox" accessibilityLabel={`${task.completed ? 'Marcar como pendiente' : 'Completar'}: ${task.title}`} accessibilityState={{ checked: task.completed, disabled: transitioning }} aria-checked={task.completed} style={styles.checkTarget}>
        <Animated.View style={[styles.checkbox, {
          transform: [{ scale: checkScale }],
          backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [color('#ffffff'), color('#1a73e8')] }),
          borderColor: progress.interpolate({ inputRange: [0, 1], outputRange: [color('#a8b1be'), color('#1a73e8')] }),
        }]}><Animated.View style={{ opacity: progress }}><MaterialIcons name="check" size={16} color="#fff" /></Animated.View></Animated.View>
      </Pressable>
      <View style={styles.editArea}>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Editar tarea: ${task.title}`} style={StyleSheet.absoluteFill} />
      <View style={styles.content} pointerEvents="box-none">
        <View style={styles.textContent} pointerEvents="none">
        <View style={styles.titleWrap}>
          <Animated.Text numberOfLines={2} ellipsizeMode="tail"
            onTextLayout={(event) => {
              const next = event.nativeEvent.lines.slice(0, 2).map(({ x, y, width, height }) => ({ x, y, width, height }));
              setLines((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
            }}
            style={[styles.title, task.completed && !transitioning && styles.completedTitle, {
              color: progress.interpolate({ inputRange: [0, 1], outputRange: [color('#202124'), color('#8b919b')] }),
            }]}>{task.title}</Animated.Text>
          {transitioning && (lines.length ? lines.map((line, index) => (
            <Animated.View key={index} pointerEvents="none" style={[styles.strike, {
              left: line.x, top: line.y + line.height / 2,
              width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, line.width] }),
            }]} />
          )) : <Animated.View pointerEvents="none" style={[styles.strike, {
            top: '50%', left: 0,
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />)}
        </View>
        {Boolean(task.description) && <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.description, task.completed && styles.completedDescription]}>{task.description}</Text>}

        </View>
      <View style={styles.metadata} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel={`Estrella: ${task.title}`} aria-pressed={task.starred} accessibilityState={{ selected: task.starred }} onPress={onStar} style={styles.starTarget}><MaterialIcons name={task.starred ? 'star' : 'star-border'} size={23} color={task.starred ? color('#1a73e8') : color('#80868b')} /></Pressable>
      {task.dueAt && <View style={styles.date} pointerEvents="none">
        <Text style={[styles.dateText, overdue && styles.overdue]}>{formatDueDate(task.dueAt, false)}</Text>
        {task.hasTime && <Text style={[styles.timeText, overdue && styles.overdue]}>{new Date(task.dueAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>}
      </View>}
      </View>
      </View>
      </View>
    </View>
    </Animated.View>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 64, overflow: 'hidden' },
  border: { borderBottomWidth: 1, borderBottomColor: color('#f0f2f5') },
  checkTarget: { width: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  editArea: { flex: 1, minWidth: 0 },
  metadata: { maxWidth: 58, flexShrink: 0, alignItems: 'center', gap: 2 },
  starTarget: { width: 36, height: 28, alignSelf: 'flex-end', borderRadius: 10, alignItems: 'flex-end', justifyContent: 'center' },
  checkbox: { width: 21, height: 21, borderWidth: 1.7, borderColor: color('#a8b1be'), borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, flexShrink: 0, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingRight: 12 },
  textContent: { flex: 1, minWidth: 0, gap: 1 },
  titleWrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  strike: { position: 'absolute', height: 1.3, backgroundColor: color('#8b919b') },
  title: { fontSize: 16, color: color('#202124'), lineHeight: 23, fontWeight: '500' },
  description: { color: color('#727780'), fontSize: 13, lineHeight: 19 },
  completedTitle: { textDecorationLine: 'line-through', color: color('#8b919b'), fontWeight: '400' },
  completedDescription: { color: color('#9aa0a6') },
  date: { maxWidth: 58, flexShrink: 0, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  dateText: { fontSize: 11, lineHeight: 15, textAlign: 'right', color: color('#80868b'), fontWeight: '500' },
  timeText: { fontSize: 12, lineHeight: 16, textAlign: 'right', color: color('#80868b'), fontWeight: '600' },
  overdue: { color: color('#b3261e') },
});
