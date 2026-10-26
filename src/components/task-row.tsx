import { useAgendaCanPress } from '@/components/agenda-pager';
import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import { formatDueDate, formatTaskDueInSection, isOverdue, type Task } from '@/models/task';

type Props = { task: Task; listName?: string; onToggle: () => void; onEdit: () => void; onStar: () => void; onDelete: (id: string) => void; animateArrival?: boolean; keepInPlace?: boolean; swipeDeleteEnabled?: boolean; isDragging?: boolean; dragHandleHandlers?: object; dueMode?: 'full' | 'section'; clockKey?: number };

function TaskRow({ task, listName, onToggle, onEdit, onStar, onDelete, animateArrival = false, keepInPlace = false, swipeDeleteEnabled = true, isDragging = false, dragHandleHandlers, dueMode = 'full' }: Props) {
  const canPress = useAgendaCanPress();
  const { styles, color, accentText, preferences } = useSectionStyles(makeStyles, 'tasks');
  const divider = preferences.dark ? '#1a1c20' : '#eceef2';
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
  const sectionDue = dueMode === 'section' ? formatTaskDueInSection(task) : null;
  const dueColor = (sectionDue?.emphasize ?? overdue) ? color('#b3261e') : accentText;
  const showDue = dueMode === 'full'
    ? Boolean(task.dueAt)
    : Boolean(sectionDue && (sectionDue.label || sectionDue.time || task.repeatEvery !== null));
  // Undated rows: center title + star with the checkbox (minHeight otherwise leaves them high).
  const compact = !showDue;
  const hasDescription = Boolean(task.description?.trim());
  const titleOnly = compact && !hasDescription && !listName;
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
    <Animated.View {...(swipeDeleteEnabled ? panResponder.panHandlers : {})} pointerEvents={transitioning ? 'none' : 'auto'} style={{ overflow: 'hidden', opacity: isDragging ? 0.92 : presence, height: rowHeight && (transitioning || entering) ? presence.interpolate({ inputRange: [0, 1], outputRange: [0, rowHeight] }) : undefined }}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.deleteBackground, { opacity: translateX.interpolate({ inputRange: [-72, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}><MaterialIcons name="delete-outline" size={24} color="#fff" /></Animated.View>
    <Animated.View onLayout={(event) => { rowWidth.current = event.nativeEvent.layout.width; if (!transitioning) setRowHeight(event.nativeEvent.layout.height); }} style={[styles.row, { borderBottomColor: divider, transform: [{ translateX }] }, isDragging && styles.rowDragging, rowHeight && (transitioning || entering) ? { height: rowHeight, flexShrink: 0 } : undefined]}>
      <Pressable onPress={toggleWithAnimation} disabled={transitioning || isDragging} accessibilityRole="checkbox" accessibilityLabel={`${task.completed ? 'Marcar como pendiente' : 'Completar'}: ${task.title}`} accessibilityState={{ checked: task.completed, disabled: transitioning || isDragging }} aria-checked={task.completed} style={styles.checkTarget}>
        <Animated.View style={[styles.checkbox, {
          transform: [{ scale: checkScale }],
          backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [color('#ffffff'), color('#1a73e8')] }),
          borderColor: progress.interpolate({ inputRange: [0, 1], outputRange: [color('#a8b1be'), color('#1a73e8')] }),
        }]}><Animated.View style={{ opacity: progress }}><MaterialIcons name="check" size={16} color="#fff" /></Animated.View></Animated.View>
      </Pressable>
      <View style={styles.editArea}>
      <Pressable onPress={() => { if (canPress() && !isDragging && !dragging.current && !deleting.current) onEdit(); }} accessibilityRole="button" accessibilityLabel={`Editar tarea: ${task.title}`} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, compact && styles.contentCompact]} pointerEvents="box-none">
        <View style={[styles.textContent, compact && styles.textContentCompact]} pointerEvents="box-none">
        {listName && <Text pointerEvents="none" accessibilityLabel={`Lista de ${task.title}: ${listName}`} numberOfLines={1} ellipsizeMode="tail" style={styles.listName}>{listName}</Text>}
        <View style={[styles.mainRow, titleOnly && styles.mainRowCompact]} pointerEvents="box-none">
          <View style={styles.textStack} pointerEvents="none">
            <View style={styles.titleWrap}>
              <Animated.Text numberOfLines={2} ellipsizeMode="tail"
                onTextLayout={(event) => {
                  const next = event.nativeEvent.lines.slice(0, 2).map(({ x, y, width, height }) => ({ x, y, width, height }));
                  setLines((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
                }}
                style={[styles.title, titleOnly && styles.titleCompact, task.completed && !transitioning && styles.completedTitle, {
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
            {hasDescription && <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.description, task.completed && styles.completedDescription]}>{task.description.trim()}</Text>}
            {showDue && <View style={styles.date}>
              <View style={styles.dateLine}>
                {task.repeatEvery !== null && <MaterialIcons testID={`task-recurrence-${task.id}`} name="repeat" size={12} color={dueColor} />}
                {dueMode === 'full' ? <>
                  <Text style={[styles.dateText, { color: dueColor }]}>{formatDueDate(task.dueAt!, false)}</Text>
                  {task.hasTime && <Text style={[styles.timeText, { color: dueColor }]}>{new Date(task.dueAt!).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>}
                </> : <>
                  {sectionDue?.label ? <Text style={[styles.dateText, { color: dueColor }]}>{sectionDue.label}</Text> : null}
                  {sectionDue?.time ? <Text style={[styles.timeText, { color: dueColor }]}>{sectionDue.time}</Text> : null}
                </>}
              </View>
            </View>}
          </View>
        </View>
        </View>
      </View>
      </View>
      <View style={styles.titleActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Estrella: ${task.title}`} aria-pressed={task.starred} accessibilityState={{ selected: task.starred }} onPress={() => { if (canPress() && !isDragging && !dragging.current && !deleting.current) onStar(); }} style={styles.starTarget}><MaterialIcons name={task.starred ? 'star' : 'star-border'} size={23} color={task.starred ? color('#1a73e8') : color('#80868b')} /></Pressable>
        {dragHandleHandlers ? <View accessibilityRole="button" accessibilityLabel={`Reordenar ${task.title}`} accessibilityHint="Mantén pulsado y arrastra para cambiar el orden" style={styles.dragHandle} {...dragHandleHandlers}><MaterialIcons name="drag-indicator" size={22} color={color('#80868b')} /></View> : null}
      </View>
    </Animated.View>
    </Animated.View>
  );
}

function sameTaskRow(previous: Props, next: Props) {
  // The row data and current item identity determine its actions; unrelated screen updates do not need to rebuild this animated tree.
  return previous.task === next.task && previous.listName === next.listName && previous.animateArrival === next.animateArrival &&
    previous.keepInPlace === next.keepInPlace && previous.swipeDeleteEnabled === next.swipeDeleteEnabled &&
    previous.isDragging === next.isDragging && previous.dragHandleHandlers === next.dragHandleHandlers &&
    previous.dueMode === next.dueMode && previous.clockKey === next.clockKey;
}

export default memo(TaskRow, sameTaskRow);

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  deleteBackground: { backgroundColor: color('#b3261e'), alignItems: 'flex-end', justifyContent: 'center', paddingRight: 24 },
  row: { backgroundColor: color('#f8fafd'), flexDirection: 'row', alignItems: 'stretch', minHeight: 60, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth },
  rowDragging: { backgroundColor: color('#edf3fd') },
  checkTarget: { width: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  editArea: { flex: 1, minWidth: 0, justifyContent: 'center' },
  titleActions: { flexDirection: 'row', alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', flexShrink: 0, paddingRight: 6 },
  starTarget: { width: 36, height: 36, flexShrink: 0, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dragHandle: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 21, height: 21, borderWidth: 1.7, borderColor: color('#a8b1be'), borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, flexShrink: 0, minWidth: 0, paddingVertical: 8, justifyContent: 'center' },
  contentCompact: { minHeight: 60, paddingVertical: 0, justifyContent: 'center' },
  textContent: { flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' },
  textContentCompact: { justifyContent: 'center' },
  listName: { fontFamily: 'Manrope-Medium', fontSize: 11, lineHeight: 15, color: color('#1a73e8') },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start' },
  mainRowCompact: { minHeight: 60, alignItems: 'center' },
  textStack: { flex: 1, minWidth: 0, gap: 4 },
  titleWrap: { position: 'relative' },
  strike: { position: 'absolute', height: 1.3, backgroundColor: color('#8b919b') },
  title: { fontFamily: 'Manrope-Medium', fontSize: 17, color: color('#202124'), lineHeight: 22, fontWeight: 'normal' },
  titleCompact: { textAlignVertical: 'center' as const },
  description: { color: color('#727780'), fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 17 },
  completedTitle: { textDecorationLine: 'line-through', color: color('#8b919b'), fontWeight: '400' },
  completedDescription: { color: color('#9aa0a6') },
  date: { alignSelf: 'flex-start' },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  dateText: { fontFamily: 'Manrope-Medium', fontSize: 12, lineHeight: 15, fontWeight: 'normal' },
  timeText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, lineHeight: 15, fontWeight: 'normal' },
});
