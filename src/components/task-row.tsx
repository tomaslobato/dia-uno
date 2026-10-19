import { useAgendaCanPress } from '@/components/agenda-pager';
import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import { formatDueDate, isOverdue, type Task } from '@/models/task';

type Props = { task: Task; listName?: string; onToggle: () => void; onEdit: () => void; onStar: () => void; onDelete: (id: string) => void; animateArrival?: boolean; keepInPlace?: boolean; swipeDeleteEnabled?: boolean; last?: boolean };

export default function TaskRow({ task, listName, onToggle, onEdit, onStar, onDelete, animateArrival = false, keepInPlace = false, swipeDeleteEnabled = true, last }: Props) {
  const canPress = useAgendaCanPress();
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
  useEffect(() => { progress.setValue(task.completed ? 1 : 0); }, [task.completed, progress]);
  const [transitioning, setTransitioning] = useState(false);
  const [lines, setLines] = useState<{ x: number; y: number; width: number; height: number }[]>([]);

  const [translateX] = useState(() => new Animated.Value(0));
  const rowWidth = useRef(320);
  const deleting = useRef(false);
  const dragging = useRef(false);
  const panResponder = useMemo(() => {
    const reset = () => {
      dragging.current = false;
      Animated.spring(translateX, { toValue: 0, speed: 30, bounciness: 0, useNativeDriver: false }).start();
    };
    // PanResponder stores these callbacks; ref values are read only during gestures.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => swipeDeleteEnabled && !transitioning && !entering && !deleting.current && gesture.dx < -12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderGrant: () => { dragging.current = true; translateX.stopAnimation(); },
      onPanResponderMove: (_, gesture) => translateX.setValue(Math.min(0, gesture.dx)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > -Math.max(72, rowWidth.current * 0.25)) { reset(); return; }
        if (deleting.current) return;
        deleting.current = true;
        dragging.current = false;
        setTransitioning(true);
        Animated.sequence([
          Animated.timing(translateX, { toValue: -rowWidth.current, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
          Animated.timing(presence, { toValue: 0, duration: 140, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        ]).start(({ finished }) => {
          if (finished) onDelete(task.id);
          else { deleting.current = false; translateX.setValue(0); presence.setValue(1); setTransitioning(false); }
        });
      },
      onPanResponderTerminate: reset,
      onPanResponderTerminationRequest: () => !dragging.current,
    });
  }, [translateX, presence, onDelete, transitioning, entering, task.id, swipeDeleteEnabled]);

  function toggleWithAnimation() {
    if (!canPress() || transitioning || dragging.current || deleting.current) return;
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
      if (keepInPlace) { onToggle(); setTransitioning(false); return; }
      Animated.timing(presence, { toValue: 0, duration: 160, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(({ finished: moved }) => {
        if (moved) onToggle();
        else { presence.setValue(1); setTransitioning(false); }
      });
    });
  }

  return (
    <Animated.View {...panResponder.panHandlers} pointerEvents={transitioning ? 'none' : 'auto'} style={{ overflow: 'hidden', opacity: presence, height: rowHeight && (transitioning || entering) ? presence.interpolate({ inputRange: [0, 1], outputRange: [0, rowHeight] }) : undefined }}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.deleteBackground, { opacity: translateX.interpolate({ inputRange: [-72, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}><MaterialIcons name="delete-outline" size={24} color="#fff" /></Animated.View>
    <Animated.View onLayout={(event) => { rowWidth.current = event.nativeEvent.layout.width; if (!transitioning) setRowHeight(event.nativeEvent.layout.height); }} style={[styles.row, { transform: [{ translateX }] }, !last && styles.border, rowHeight && (transitioning || entering) ? { height: rowHeight, flexShrink: 0 } : undefined]}>
      <Pressable onPress={toggleWithAnimation} disabled={transitioning} accessibilityRole="checkbox" accessibilityLabel={`${task.completed ? 'Marcar como pendiente' : 'Completar'}: ${task.title}`} accessibilityState={{ checked: task.completed, disabled: transitioning }} aria-checked={task.completed} style={styles.checkTarget}>
        <Animated.View style={[styles.checkbox, {
          transform: [{ scale: checkScale }],
          backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [color('#ffffff'), color('#1a73e8')] }),
          borderColor: progress.interpolate({ inputRange: [0, 1], outputRange: [color('#a8b1be'), color('#1a73e8')] }),
        }]}><Animated.View style={{ opacity: progress }}><MaterialIcons name="check" size={16} color="#fff" /></Animated.View></Animated.View>
      </Pressable>
      <View style={styles.editArea}>
      <Pressable onPress={() => { if (canPress() && !dragging.current && !deleting.current) onEdit(); }} accessibilityRole="button" accessibilityLabel={`Editar tarea: ${task.title}`} style={StyleSheet.absoluteFill} />
      <View style={styles.content} pointerEvents="box-none">
        <View style={styles.textContent} pointerEvents="none">
        {listName && <Text accessibilityLabel={`Lista de ${task.title}: ${listName}`} numberOfLines={1} ellipsizeMode="tail" style={styles.listName}>{listName}</Text>}
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
      <Pressable accessibilityRole="button" accessibilityLabel={`Estrella: ${task.title}`} aria-pressed={task.starred} accessibilityState={{ selected: task.starred }} onPress={() => { if (canPress() && !dragging.current && !deleting.current) onStar(); }} style={styles.starTarget}><MaterialIcons name={task.starred ? 'star' : 'star-border'} size={23} color={task.starred ? color('#1a73e8') : color('#80868b')} /></Pressable>
      {task.dueAt && <View style={styles.date} pointerEvents="none">
        <View style={styles.dateLine}>
          {task.repeatEvery !== null && <MaterialIcons testID={`task-recurrence-${task.id}`} name="repeat" size={12} color={color('#5f6368')} />}
          <Text style={[styles.dateText, overdue && styles.overdue]}>{formatDueDate(task.dueAt, false)}</Text>
        </View>
        {task.hasTime && <Text style={[styles.timeText, overdue && styles.overdue]}>{new Date(task.dueAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>}
      </View>}
      </View>
      </View>
      </View>
    </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  deleteBackground: { backgroundColor: color('#b3261e'), alignItems: 'flex-end', justifyContent: 'center', paddingRight: 24 },
  row: { backgroundColor: color('#fff'), flexDirection: 'row', alignItems: 'stretch', minHeight: 60, overflow: 'hidden' },
  border: { borderBottomWidth: 1, borderBottomColor: color('#f0f2f5') },
  checkTarget: { width: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  editArea: { flex: 1, minWidth: 0 },
  metadata: { maxWidth: 58, flexShrink: 0, alignItems: 'center', gap: 2 },
  starTarget: { width: 36, height: 28, alignSelf: 'flex-end', borderRadius: 10, alignItems: 'flex-end', justifyContent: 'center' },
  checkbox: { width: 21, height: 21, borderWidth: 1.7, borderColor: color('#a8b1be'), borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, flexShrink: 0, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingRight: 10 },
  textContent: { flex: 1, minWidth: 0, gap: 1 },
  listName: { fontFamily: 'Manrope-Medium', fontSize: 17, lineHeight: 23, color: color('#1a73e8') },
  titleWrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  strike: { position: 'absolute', height: 1.3, backgroundColor: color('#8b919b') },
  title: { fontFamily: 'Manrope-Medium', fontSize: 17, color: color('#202124'), lineHeight: 23, fontWeight: 'normal' },
  description: { color: color('#727780'), fontFamily: 'Manrope-Regular', fontSize: 14, lineHeight: 19 },
  completedTitle: { textDecorationLine: 'line-through', color: color('#8b919b'), fontWeight: '400' },
  completedDescription: { color: color('#9aa0a6') },
  date: { maxWidth: 58, flexShrink: 0, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dateText: { fontFamily: 'Manrope-Medium', fontSize: 11, lineHeight: 15, textAlign: 'right', color: color('#80868b'), fontWeight: 'normal' },
  timeText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, lineHeight: 16, textAlign: 'right', color: color('#80868b'), fontWeight: 'normal' },
  overdue: { color: color('#b3261e') },
});
