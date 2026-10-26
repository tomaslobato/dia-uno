import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import Pressable from '@/components/feedback-pressable';
import { AgendaDayButton } from '@/components/agenda-pager';
import AgendaHabitEntry from '@/components/agenda-habit-entry';
import { useHabits } from '@/hooks/use-habits';
import AgendaTaskEntry from '@/components/agenda-task-entry';
import HabitModal from '@/components/habit-modal';
import TaskEditor from '@/components/task-editor';
import WeekScrollHint from '@/components/week-scroll-hint';
import { useTaskDeletion } from '@/hooks/use-task-deletion';
import { SectionEntrance } from '@/components/section-motion';
import { useSectionStyles } from '@/theme/appearance';
import { useTasks } from '@/hooks/use-tasks';
import { dayKey, localDay } from '@/models/habit';
import { agendaHabitsForDay, isAgendaTaskOverdue, compareAgendaTasks, agendaWeekTitle, calendarWeekDays, calendarMonthDays, overdueAgendaDays, validAgendaDay } from '@/models/agenda';
import { asOccurrence, isRecurringTask, taskOccursOnDay, type Task } from '@/models/task';

type AgendaView = 'month' | 'week';
const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DETAILED_ENTRY_HEIGHT = 92;

export default function AgendaScreen() {
  const params = useLocalSearchParams<{ view?: string; date?: string }>();
  const initialDate = validAgendaDay(params.date) ? localDay(params.date) : new Date();
  const { styles, color, accent, accentText, soft, preferences } = useSectionStyles(makeStyles, 'agenda');
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { tasks, lists, ready, error, saveTask, toggleTask, toggleStar, deleteTask } = useTasks();
  const { habits, updateHabit, toggleDay, deleteHabit } = useHabits();
  const { removedId, undoDelete } = useTaskDeletion(deleteTask);
  const visibleTasks = useMemo(() => tasks.filter((task) => task.id !== removedId), [tasks, removedId]);
  const listNames = useMemo(() => new Map(lists.map((list) => [list.id, list.name])), [lists]);
  const [editing, setEditing] = useState<{ id: string; day: string } | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const editingHabit = habits.find((habit) => habit.id === editingHabitId);
  const editingTask = editing ? tasks.find((task) => task.id === editing.id) : undefined;
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1, 12));
  const [view, setView] = useState<AgendaView>(params.view === 'week' || params.view === '3' || validAgendaDay(params.date) ? 'week' : 'month');
  const detailed = view === 'week';
  const [weekAnchor, setWeekAnchor] = useState(() => initialDate);
  const [gridHeight, setGridHeight] = useState(0);
  const [weekViewport, setWeekViewport] = useState({ width: 0, height: 0 });
  const [focusDay, setFocusDay] = useState(() => dayKey(initialDate));
  const weekScroll = useRef<ScrollView>(null);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 60000);
    const listener = AppState.addEventListener('change', refresh);
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  const today = dayKey(now);
  const weekDays = useMemo(() => calendarWeekDays(weekAnchor), [weekAnchor]);
  const weeks = useMemo(() => detailed ? [weekDays] : calendarMonthDays(month), [detailed, weekDays, month]);
  const visibleDays = useMemo(() => (detailed ? weekDays : weeks.flat()), [detailed, weekDays, weeks]);
  const overdueDays = useMemo(() => overdueAgendaDays(visibleTasks, visibleDays, now), [visibleTasks, visibleDays, now]);
  const byDay = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    const addTaskToDay = (day: string, task: Task) => {
      const entries = grouped.get(day);
      if (entries) entries.push(task);
      else grouped.set(day, [task]);
    };
    const sorted = [...visibleTasks].sort((a, b) => compareAgendaTasks(a, b, detailed));
    for (const day of visibleDays) {
      for (const task of sorted) {
        if (taskOccursOnDay(task, day)) addTaskToDay(day, isRecurringTask(task) ? asOccurrence(task, day) : task);
      }
    }
    // Non-recurring overdue items also surface on today (recurring stays on its own day).
    if (visibleDays.includes(today)) {
      for (const task of sorted) {
        if (isRecurringTask(task) || !task.dueAt || task.completed) continue;
        const originalDay = dayKey(new Date(task.dueAt));
        if (originalDay !== today && isAgendaTaskOverdue(task, now)) addTaskToDay(today, task);
      }
    }
    return grouped;
  }, [visibleTasks, visibleDays, detailed, today, now]);
  const maxEntries = Math.max(
    habits.length ? 2 : 1,
    Math.min(detailed ? 20 : 5, Math.floor((Math.max(gridHeight / weeks.length, habits.length ? 140 : 80) - (habits.length ? 64 : 42)) / (detailed ? DETAILED_ENTRY_HEIGHT : habits.length ? 34 : 21))),
  );
  const monthTitle = detailed ? agendaWeekTitle(weekDays, false) : month.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  // Web: full week, no horizontal pan. Native: ~3 days wide, scroll across the 7.
  const fixedWeek = Platform.OS === 'web';
  const columnWidth = fixedWeek
    ? Math.max(1, Math.floor((weekViewport.width > 0 ? weekViewport.width : Math.max(windowWidth - 24, 360)) / 7))
    : Math.max(120, Math.floor((weekViewport.width > 0 ? weekViewport.width : Math.max(windowWidth - 24, 360)) / 3));
  useEffect(() => {
    if (fixedWeek || !detailed || weekViewport.width <= 0 || columnWidth <= 0) return;
    const index = Math.max(0, weekDays.indexOf(focusDay));
    // Selected day flush to the left of the scroll viewport.
    const target = index * columnWidth;
    const id = requestAnimationFrame(() => weekScroll.current?.scrollTo({ x: target, animated: false }));
    return () => cancelAnimationFrame(id);
  }, [fixedWeek, detailed, weekDays, focusDay, columnWidth, weekViewport.width]);

  function changePeriod(delta: number) {
    if (detailed) {
      setWeekAnchor((current) => {
        const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta * 7, 12);
        setFocusDay(dayKey(next));
        return next;
      });
    } else setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));
  }
  function changeView(next: AgendaView) {
    if (next === 'week' && view === 'month') {
      const anchor = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth() ? now : month;
      setWeekAnchor(anchor);
      setFocusDay(dayKey(anchor));
    }
    if (next === 'month' && view === 'week') setMonth(new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), 1, 12));
    setView(next);
  }
  function openDay(day: string) {
    if (view === 'week') {
      setCreatingOn(day);
      return;
    }
    setWeekAnchor(localDay(day));
    setFocusDay(day);
    setView('week');
  }
  function dayContent(day: string) {
    const items = byDay.get(day) ?? [];
    const dayHabits = agendaHabitsForDay(habits, day, today);
    const taskLimit = dayHabits.length ? Math.max(1, maxEntries - 1) : maxEntries;
    const shownTasks = items.slice(0, taskLimit);
    const habitLimit = Math.max(1, maxEntries - shownTasks.length);
    const shownHabits = dayHabits.slice(0, habitLimit);
    return { items, dayHabits, shownTasks, shownHabits, habitLimit, taskLimit };
  }
  function renderDayCell(day: string, options?: { width?: number; outside?: boolean }) {
    const date = localDay(day);
    const { items, dayHabits, shownTasks, shownHabits, habitLimit, taskLimit } = dayContent(day);
    const hasOverdue = overdueDays.has(day);
    const isToday = day === today;
    return (
      <View
        key={day}
        testID={`agenda-day-${day}`}
        style={[
          styles.cell,
          detailed && styles.weekCell,
          options?.outside && styles.outsideCell,
          isToday && { backgroundColor: soft },
          options?.width != null && { width: options.width, flexGrow: 0, flexShrink: 0, flexBasis: options.width },
        ]}
      >
        <AgendaDayButton
          accessibilityRole="button"
          accessibilityLabel={`${date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}, ${items.filter((task) => !task.completed).length} pendientes, ${items.filter((task) => task.completed).length} completadas, ${dayHabits.length} hábitos${hasOverdue ? ', tareas atrasadas' : ''}`}
          accessibilityHint={detailed ? 'Crear una tarea en este día' : 'Abrir la vista semanal en este día'}
          onPress={() => openDay(day)}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.dayHeader}>
          <View style={[styles.dayNumberCircle, detailed && styles.detailedDayCircle, isToday && { backgroundColor: accent }]}>
            <Text style={[styles.dayNumber, detailed && styles.detailedDayNumber, options?.outside && styles.outsideNumber, isToday && styles.todayNumber]}>{date.getDate()}</Text>
          </View>
        </View>
        <View pointerEvents="box-none" style={styles.entries}>
          {shownTasks.map((task) => (
            <AgendaTaskEntry
              key={`${task.id}@${day}`}
              task={task}
              day={day}
              detailed={detailed}
              now={now}
              listName={task.listId ? listNames.get(task.listId) : undefined}
              onEdit={() => setEditing({ id: task.id, day })}
            />
          ))}
          {items.length > taskLimit && <Text numberOfLines={1} style={[styles.more, detailed && styles.moreDetailed]}>+{items.length - taskLimit} más</Text>}
          {shownHabits.length > 0 && (
            <View style={styles.habitEntries}>
              {shownHabits.map((habit) => <AgendaHabitEntry key={habit.id} habit={habit} day={day} today={today} detailed={detailed} onEdit={() => setEditingHabitId(habit.id)} />)}
              {dayHabits.length > habitLimit && <Text numberOfLines={1} style={[styles.more, detailed && styles.moreDetailed, { color: preferences.habits }]}>+{dayHabits.length - habitLimit} hábitos</Text>}
            </View>
          )}
        </View>
      </View>
    );
  }

  function renderMonth() {
    return (
      <View style={styles.monthFrame}>
        <View style={styles.weekdays}>
          {weekdays.map((label) => <Text key={label} style={styles.weekday}>{label}</Text>)}
        </View>
        <View onLayout={(event) => setGridHeight(event.nativeEvent.layout.height)} style={styles.monthGrid}>
          {weeks.map((week) => (
            <View key={week[0]} style={styles.monthWeek}>
              {week.map((day) => renderDayCell(day, {
                outside: localDay(day).getMonth() !== month.getMonth(),
              }))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderWeek() {
    const days = weekDays;
    const height = weekViewport.height;
    const labelStripHeight = 28;
    const labels = (
      <View style={[styles.weekLabelStrip, { height: labelStripHeight, flexGrow: 0, flexShrink: 0 }]}>
        {days.map((day) => (
          <View key={`label-${day}`} style={[styles.weekLabelCell, fixedWeek ? styles.weekLabelCellFlex : { width: columnWidth }]}>
            <Text style={styles.weekLabelText}>{weekdays[(localDay(day).getDay() + 6) % 7]}</Text>
          </View>
        ))}
      </View>
    );
    const dayRow = (
      <View style={[styles.grid, styles.weekTaskGrid, { flex: 1, minHeight: 0 }]}>
        <View style={styles.week}>
          {days.map((day) => renderDayCell(day, fixedWeek ? undefined : { width: columnWidth }))}
        </View>
      </View>
    );
    return (
      <View
        style={styles.calendarFrame}
        onLayout={(event) => {
          const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
          setWeekViewport((current) => (
            current.width === nextWidth && current.height === nextHeight
              ? current
              : { width: nextWidth, height: nextHeight }
          ));
          setGridHeight(Math.max(120, nextHeight - labelStripHeight));
        }}
      >
        {fixedWeek ? (
          // Always mount on web — waiting for height>0 left the week blank when flex layout reported 0.
          <View style={styles.weekFixed}>
            {labels}
            {dayRow}
          </View>
        ) : height > 0 ? (
          <ScrollView
            ref={weekScroll}
            horizontal
            style={styles.weekScroller}
            contentContainerStyle={{ height }}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={columnWidth}
            snapToAlignment="start"
            disableIntervalMomentum
          >
            <View style={{ width: columnWidth * 7, height, flexDirection: 'column' }}>
              {labels}
              {dayRow}
            </View>
          </ScrollView>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.page}>
        <SectionEntrance section="/agenda" order={0}>
          <View style={styles.toolbar}>
            <View style={styles.monthBlock}>
              <Text accessibilityRole="header" style={styles.monthTitle}>{monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)}</Text>
              <Text style={styles.viewLabel}>{detailed ? 'Vista semanal' : 'Vista mensual'}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={detailed ? 'Volver a la semana actual' : 'Volver al mes actual'} onPress={() => { setWeekAnchor(now); setFocusDay(today); setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12)); }} style={styles.todayButton}>
              <Text style={styles.todayText}>Hoy</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={detailed ? 'Semana anterior' : 'Mes anterior'} onPress={() => changePeriod(-1)} style={styles.arrow}>
              <MaterialIcons name="chevron-left" size={24} color={color('#202124')} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={detailed ? 'Semana siguiente' : 'Mes siguiente'} onPress={() => changePeriod(1)} style={styles.arrow}>
              <MaterialIcons name="chevron-right" size={24} color={color('#202124')} />
            </Pressable>
          </View>
        </SectionEntrance>
        <SectionEntrance section="/agenda" order={1}>
          <View style={styles.viewSwitch}>
            {([{ value: 'month' as const, label: 'Mes' }, { value: 'week' as const, label: 'Semana' }]).map(({ value, label }) => (
              <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Vista ${label.toLowerCase()}`} accessibilityState={{ selected: view === value }} aria-pressed={view === value} onPress={() => changeView(value)} style={[styles.viewButton, view === value && { backgroundColor: soft }]}>
                <Text style={[styles.viewButtonText, view === value && { color: accentText }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </SectionEntrance>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!ready && !error && <ActivityIndicator color={accent} />}
        <SectionEntrance section="/agenda" order={2} style={styles.calendarSection}>
          {detailed ? renderWeek() : renderMonth()}
        </SectionEntrance>
        {removedId && (
          <View accessibilityLiveRegion="polite" style={[styles.undoBar, { bottom: 98 - (59 + Math.max(insets.bottom, 8)) }]}>
            <Text style={styles.undoMessage}>Tarea eliminada</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Deshacer eliminación" onPress={undoDelete} style={styles.undoButton}>
              <Text style={styles.undoText}>Deshacer</Text>
            </Pressable>
          </View>
        )}
        <View pointerEvents="box-none" style={[styles.newTaskWrap, { bottom: 11 }]}>
          <Pressable disabled={!ready} accessibilityRole="button" accessibilityLabel="Nueva tarea" onPress={() => setCreatingOn(today)} style={[styles.newTaskButton, !ready && { opacity: 0.5 }]}>
            <MaterialIcons name="add" size={28} color="#fff" />
          </Pressable>
        </View>
      </View>
      {(editingTask || creatingOn) && <TaskEditor key={editingTask ? `${editingTask.id}@${editing!.day}` : `new-agenda-task-${creatingOn}`} task={editingTask} occurrenceDay={editing?.day} initialDate={!editingTask && creatingOn ? localDay(creatingOn) : undefined} lists={lists} initialListId={editingTask?.listId ?? null} onSave={saveTask} onToggle={(id) => toggleTask(id, editing?.day)} onStar={toggleStar} onClose={() => { setEditing(null); setCreatingOn(null); }} />}
      {editingHabit && <HabitModal key={editingHabit.id} habit={editingHabit} today={today} onClose={() => setEditingHabitId(null)} onSave={(draft) => updateHabit(editingHabit.id, draft)} onToggle={(day) => toggleDay(editingHabit.id, day)} onDelete={() => deleteHabit(editingHabit.id)} />}
      <WeekScrollHint active={detailed && !fixedWeek} />
    </SafeAreaView>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color('#f8fafd') },
  page: { flex: 1, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, gap: 2, paddingBottom: 6 },
  monthBlock: { flex: 1, minWidth: 0 },
  monthTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 21, color: color('#202124') },
  viewLabel: { fontFamily: 'Manrope-Regular', fontSize: 11, color: color('#80868b'), marginTop: 2 },
  todayButton: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: color('#e8f0fe') },
  todayText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#185abc') },
  arrow: { width: 36, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  viewSwitch: { flexDirection: 'row', alignSelf: 'flex-start', marginHorizontal: 12, marginBottom: 6, padding: 3, borderRadius: 12, borderWidth: 1, borderColor: color('#edf0f5') },
  viewButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  viewButtonText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#80868b') },
  calendarSection: { flex: 1, minHeight: 0, width: '100%', alignSelf: 'stretch' },
  calendarFrame: { flex: 1, minHeight: 0, width: '100%', marginHorizontal: 6, alignSelf: 'stretch' },
  monthFrame: { flex: 1, minHeight: 0, width: '100%', marginHorizontal: 6, paddingBottom: 30 },
  weekScroller: { flex: 1 },
  weekFixed: { flex: 1, minHeight: 280, width: '100%', flexDirection: 'column', alignSelf: 'stretch' },
  weekCell: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8 },
  // Literal black/gray — do not pass through `color()` (it remaps #202124 to theme text, white in dark mode).
  weekLabelStrip: { flexDirection: 'row', width: '100%', backgroundColor: '#000000', borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  weekLabelCell: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  weekLabelCellFlex: { flex: 1, minWidth: 0 },
  weekLabelText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#9aa0a6' },
  undoBar: { position: 'absolute', left: 24, right: 24, bottom: 34, backgroundColor: color('#fff'), borderWidth: 1, borderColor: color('#edf0f5'), borderRadius: 16, paddingLeft: 16, paddingRight: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0px 4px 18px rgba(0,0,0,0.15)' },
  undoMessage: { fontFamily: 'Manrope-Regular', fontSize: 14, color: color('#202124') },
  undoButton: { paddingHorizontal: 14, paddingVertical: 16, borderRadius: 12 },
  undoText: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: color('#1a73e8') },
  weekdays: { flexDirection: 'row', paddingBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: 'Manrope-Medium', fontSize: 11, color: color('#80868b') },
  grid: { flex: 1, minHeight: 0, borderTopWidth: 1, borderLeftWidth: 1, borderColor: color('#edf0f5'), borderRadius: 12, overflow: 'hidden' },
  monthGrid: { flex: 1, minHeight: 0, borderTopWidth: 1, borderLeftWidth: 1, borderColor: color('#edf0f5'), borderRadius: 12, overflow: 'hidden' },
  weekTaskGrid: { borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  week: { flex: 1, flexBasis: 0, minHeight: 0, flexDirection: 'row' },
  monthWeek: { flex: 1, flexBasis: 0, minHeight: 0, flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, minHeight: 0, paddingHorizontal: 3, paddingTop: 5, paddingBottom: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: color('#edf0f5'), backgroundColor: color('#fff'), overflow: 'hidden' },
  outsideCell: { backgroundColor: color('#f8fafd') },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 3, marginBottom: 2 },
  dayNumberCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  detailedDayCircle: { width: 30, height: 30, borderRadius: 15 },
  dayNumber: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#202124') },
  detailedDayNumber: { fontSize: 14 },
  outsideNumber: { color: color('#9aa0a6') },
  todayNumber: { color: '#fff' },
  entries: { gap: 8 },
  more: { fontFamily: 'Manrope-Regular', fontSize: 9, lineHeight: 12, color: color('#80868b'), paddingLeft: 3 },
  moreDetailed: { fontFamily: 'Manrope-Medium', fontSize: 12, lineHeight: 16, paddingLeft: 4 },
  habitEntries: { gap: 8, paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderColor: color('#edf0f5') },
  error: { fontFamily: 'Manrope-Regular', fontSize: 12, color: color('#b3261e'), paddingHorizontal: 12, paddingBottom: 8 },
  newTaskWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'flex-end', paddingHorizontal: 12 },
  newTaskButton: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color('#1a73e8'), elevation: 3, boxShadow: '0px 5px 18px rgba(26,115,232,0.22)' },
});
