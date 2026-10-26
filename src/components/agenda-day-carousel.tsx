import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AgendaDayButton, AgendaPressGuard } from '@/components/agenda-pager';
import TaskRow from '@/components/task-row';
import { useSectionStyles } from '@/theme/appearance';
import { agendaDayLabel, agendaTasksForDay, shiftAgendaDay } from '@/models/agenda';
import { matchesTaskDate, staysInTaskSchedule, taskDateSection, type Task } from '@/models/task';
import type { TaskList } from '@/models/task-list';
import { dayKey, localDay } from '@/models/habit';

type Props = { day: string; tasks: Task[]; lists: TaskList[]; now: Date; selectedListHeight: number; onStep: (direction: number) => void; children: ReactNode };
const noop = () => {};
export default function AgendaDayCarousel({ day, tasks, lists, now, selectedListHeight, onStep, children }: Props) {
  const { styles, color, preferences } = useSectionStyles(makeStyles, 'tasks');
  const [width, setWidth] = useState(320);
  const pageWidth = Math.max(180, width - 80);
  const step = pageWidth + 12;
  const [position] = useState(() => new Animated.Value(-252));
  const [selectedScale] = useState(() => new Animated.Value(1));
  const [moving, setMoving] = useState(false);
  const previousDay = useRef(day);
  const busy = useRef(false);
  const dragging = useRef(false);
  const reduced = useRef(true);
  const alive = useRef(true);
  const canPress = useCallback(() => !busy.current && !dragging.current, []);
  useEffect(() => {
    alive.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive.current) reduced.current = value; }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { reduced.current = value; });
    return () => { alive.current = false; position.stopAnimation(); listener.remove(); };
  }, [position]);
  // Recenter only after the new day's three panels have committed, before paint.
  useLayoutEffect(() => {
    position.stopAnimation();
    position.setValue(-step);
    if (previousDay.current !== day) {
      previousDay.current = day;
      selectedScale.setValue(1);
      Animated.sequence([
        Animated.timing(selectedScale, { toValue: 0.975, duration: 75, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(selectedScale, { toValue: 1, duration: 110, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
    const frame = requestAnimationFrame(() => { busy.current = false; dragging.current = false; if (alive.current) setMoving(false); });
    return () => { cancelAnimationFrame(frame); selectedScale.stopAnimation(); };
  }, [day, step, position, selectedScale]);
  function move(direction: number) {
    if (busy.current) return;
    busy.current = true;
    dragging.current = true;
    setMoving(true);
    if (reduced.current) { onStep(direction); return; }
    Animated.timing(position, { toValue: -step - direction * step, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (finished && alive.current) onStep(direction);
      else { busy.current = false; dragging.current = false; if (alive.current) setMoving(false); }
    });
  }
  const responder = useMemo(() => {
    const reset = () => {
      Animated.spring(position, { toValue: -step, speed: 32, bounciness: 0, useNativeDriver: false }).start(() => { dragging.current = false; });
    };
    // PanResponder stores these callbacks; refs are accessed only during a gesture.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => !busy.current && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderGrant: (event) => { event.preventDefault(); dragging.current = true; position.stopAnimation(); },
      onPanResponderMove: (_, gesture) => { if (!reduced.current) position.setValue(-step + Math.max(-step, Math.min(step, gesture.dx))); },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) >= Math.max(48, pageWidth * 0.15)) move(gesture.dx < 0 ? 1 : -1);
        else reset();
      },
      onPanResponderTerminate: reset,
      onPanResponderTerminationRequest: () => false,
    });
  // move's values are the same values listed below; the callback runs only on release.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pageWidth, position, onStep]);
  return <AgendaPressGuard canPress={canPress}>
    <View testID="agenda-day-carousel" {...responder.panHandlers} pointerEvents={moving ? 'none' : 'auto'} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.viewport}>
      <Animated.View testID="agenda-day-strip" style={[styles.strip, { width: step * 3, transform: [{ translateX: position }] }]}>
        {([-1, 0, 1] as const).map((direction) => {
          const opacity = position.interpolate({ inputRange: [-2 * step, -step, 0], outputRange: direction === 1 ? [1, 0.55, 0.55] : direction === -1 ? [0.55, 0.55, 1] : [0.55, 1, 0.55], extrapolate: 'clamp' });
          if (direction === 0) return <Animated.View key="current" style={[styles.page, { width: pageWidth, transform: [{ scale: selectedScale }] }]}><Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View></Animated.View>;
          const neighbor = shiftAgendaDay(day, direction);
          const items = agendaTasksForDay(tasks, neighbor, true, now);
          const pending = items.filter((task) => staysInTaskSchedule(task, now));
          const completed = items.filter((task) => !staysInTaskSchedule(task, now));
          const groups: { title: string; tasks: Task[] }[] = [];
          for (const task of pending) {
            const title = taskDateSection(task, now);
            const group = groups[groups.length - 1];
            if (group?.title === title) group.tasks.push(task); else groups.push({ title, tasks: [task] });
          }
          return <Animated.View key={direction} style={[styles.page, { width: pageWidth, opacity }]}>
            <View testID={direction < 0 ? 'agenda-previous-day-preview' : 'agenda-next-day-preview'} style={styles.preview}>
              <AgendaDayButton accessibilityRole="button" accessibilityLabel={`${direction < 0 ? 'Día anterior' : 'Día siguiente'}: ${agendaDayLabel(neighbor, now)}`} onPress={() => move(direction)} style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={[styles.previewCard, { height: selectedListHeight, borderColor: preferences.dark ? '#68717e' : '#858b95' }]}>
                <View style={styles.heading}><View style={[styles.dayNumber, neighbor === dayKey(now) && { backgroundColor: preferences.agenda }]}><Text style={[styles.dayNumberText, neighbor === dayKey(now) && { color: '#fff' }]}>{localDay(neighbor).getDate()}</Text></View><Text style={styles.title}>{agendaDayLabel(neighbor, now)}</Text></View>
                {groups.map((group) => <View key={group.title} style={styles.card}>{group.tasks.map((task) => <TaskRow key={task.id} task={task} clockKey={Math.floor(now.getTime() / 60000)} listName={lists.find((list) => list.id === task.listId)?.name} keepInPlace={matchesTaskDate(task, 'today', now)} swipeDeleteEnabled={false} onToggle={noop} onEdit={noop} onStar={noop} onDelete={noop} />)}</View>)}
                {pending.length === 0 && <View style={styles.empty}><MaterialIcons name="done-all" size={36} color={color('#1a73e8')} /><Text style={styles.emptyTitle}>{completed.length ? 'Todo al día.' : 'No hay tareas para este día.'}</Text></View>}
                {completed.length > 0 && <View style={styles.completed}><MaterialIcons name="keyboard-arrow-right" size={21} color={color('#80868b')} /><Text style={styles.completedText}>Completadas {completed.length}</Text></View>}
              </View>
            </View>
          </Animated.View>;
        })}
      </Animated.View>
    </View>
  </AgendaPressGuard>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' }, strip: { flex: 1, flexDirection: 'row', marginLeft: 40 }, page: { flexShrink: 0, marginRight: 12 }, preview: { flex: 1 }, previewCard: { marginHorizontal: 8, borderWidth: 1.5, borderRadius: 18, overflow: 'hidden', backgroundColor: color('#fff') },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }, title: { fontFamily: 'Manrope-SemiBold', fontSize: 26, lineHeight: 34, color: color('#202124') }, dayNumber: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, dayNumberText: { fontFamily: 'Manrope-SemiBold', fontSize: 19, lineHeight: 25, color: color('#202124') },
  card: { backgroundColor: color('#fff'), borderWidth: 1, borderColor: color('#edf0f5'), borderRadius: 18, overflow: 'hidden', marginBottom: 12 }, empty: { alignItems: 'center', paddingVertical: 48, gap: 20 }, emptyTitle: { fontFamily: 'Manrope-Medium', fontSize: 18, color: color('#5f6368'), textAlign: 'center' },
  completed: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 25, paddingVertical: 10 }, completedText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#80868b') },
});
