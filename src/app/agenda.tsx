import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Pressable from '@/components/feedback-pressable';
import AgendaPager, { AgendaDayButton } from '@/components/agenda-pager';
import AgendaHabitEntry from '@/components/agenda-habit-entry';
import { useHabits } from '@/hooks/use-habits';
import AgendaTaskEntry from '@/components/agenda-task-entry';
import HabitModal from '@/components/habit-modal';
import TaskEditor from '@/components/task-editor';
import { useTaskDeletion } from '@/hooks/use-task-deletion';
import SectionTabs from '@/components/section-tabs';
import { useSectionStyles } from '@/theme/appearance';
import { useTasks } from '@/hooks/use-tasks';
import { dayKey, localDay } from '@/models/habit';
import { agendaHabitsForDay, isAgendaTaskOverdue, compareAgendaTasks, agendaWeekTitle, calendarRangeDays, calendarWeekDays, calendarMonthDays, overdueAgendaDays, taskAgendaDay, validAgendaDay } from '@/models/agenda';
import { type Task } from '@/models/task';

type AgendaView = 'month' | 'week' | '3';
const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export default function AgendaScreen() {
  const params = useLocalSearchParams<{ view?: string; date?: string }>();
  const initialDate = validAgendaDay(params.date) ? localDay(params.date) : new Date();
  const { styles, color, accent, soft, preferences } = useSectionStyles(makeStyles, 'agenda');
  const { tasks, lists, ready, error, saveTask, toggleTask, toggleStar, deleteTask } = useTasks();
  const { habits, updateHabit, toggleDay, deleteHabit } = useHabits();
  const { removedId, removeTask, undoDelete } = useTaskDeletion(deleteTask);
  const visibleTasks = tasks.filter((task) => task.id !== removedId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const editingHabit = habits.find((habit) => habit.id === editingHabitId);
  const editingTask = tasks.find((task) => task.id === editingId);
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1, 12));
  const { width } = useWindowDimensions();
  const mobile = Platform.OS !== 'web' || width < 768;
  const [view, setView] = useState<AgendaView>(params.view === 'month' ? 'month' : params.view === 'week' ? 'week' : mobile ? '3' : 'week');
  const effectiveView: AgendaView = view === 'month' ? 'month' : mobile ? '3' : 'week';
  const detailed = effectiveView !== 'month';
  const dayCount = effectiveView === 'week' ? 7 : 3;
  const viewOptions: { value: AgendaView; label: string }[] = mobile ? [{ value: 'month', label: 'Mes' }, { value: '3', label: '3 días' }] : [{ value: 'month', label: 'Mes' }, { value: 'week', label: 'Semana' }];
  const [weekAnchor, setWeekAnchor] = useState(() => initialDate);
  const weekly = effectiveView === 'week';
  const [gridHeight, setGridHeight] = useState(0);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 30000);
    const listener = AppState.addEventListener('change', refresh);
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  const today = dayKey(now);
  const weekDays = weekly ? calendarWeekDays(weekAnchor) : calendarRangeDays(weekAnchor, 3);
  const weeks = detailed ? [weekDays] : calendarMonthDays(month);
  const overdueDays = overdueAgendaDays(visibleTasks, now);
  const byDay = new Map<string, Task[]>();
  for (const task of [...visibleTasks].sort((a, b) => compareAgendaTasks(a, b, detailed))) {
    const day = taskAgendaDay(task);
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), task]);
    if (day && day !== today && isAgendaTaskOverdue(task, now)) byDay.set(today, [...(byDay.get(today) ?? []), task]);
  }
  const maxEntries = Math.max(habits.length ? 2 : 1, Math.min(detailed ? 30 : 5, Math.floor((Math.max(gridHeight / weeks.length, habits.length ? 120 : 80) - (habits.length ? 58 : 42)) / (detailed ? 95 : habits.length ? 34 : 21))));
  const monthTitle = detailed ? agendaWeekTitle(weekDays) : month.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  function changePeriod(delta: number) {
    if (detailed) setWeekAnchor((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta * dayCount, 12));
    else setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));
  }
  function changeView(next: AgendaView) {
    if (next !== 'month' && !detailed) setWeekAnchor(month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth() ? now : month);
    if (next === 'month' && detailed) setMonth(new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), 1, 12));
    setView(next);
  }
  function renderCalendar(offset: number) {
    const anchor = new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate() + offset * 3, 12);
    const displayedWeeks = offset === 0 ? weeks : [calendarRangeDays(anchor, 3)];
    const dayLabels = detailed ? displayedWeeks[0].map((day) => weekdays[(localDay(day).getDay() + 6) % 7]) : weekdays;
    return (
      <ScrollView key={`${effectiveView}-${dayKey(anchor)}`} style={styles.calendarScroll} contentContainerStyle={styles.calendarContent} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
        <View style={styles.calendarBody}>
        <View style={styles.weekdays}>{dayLabels.map((label) => <Text key={label} style={styles.weekday}>{label}</Text>)}</View>
        <View onLayout={offset === 0 ? (event) => setGridHeight(event.nativeEvent.layout.height) : undefined} style={[styles.grid, !detailed && habits.length > 0 && { minHeight: displayedWeeks.length * 120 }]}>
          {displayedWeeks.map((week) => <View key={week[0]} style={styles.week}>
            {week.map((day) => {
              const date = localDay(day);
              const outside = !detailed && date.getMonth() !== month.getMonth();
              const items = byDay.get(day) ?? [];
              const dayHabits = agendaHabitsForDay(habits, day, today);
              const taskLimit = dayHabits.length ? Math.max(1, maxEntries - 1) : maxEntries;
              const shownTasks = items.slice(0, taskLimit);
              const habitLimit = Math.max(1, maxEntries - shownTasks.length);
              const shownHabits = dayHabits.slice(0, habitLimit);
              const hasOverdue = overdueDays.has(day);
              const isToday = day === today;
              return <View key={day} testID={`agenda-day-${day}`} style={[styles.cell, detailed && styles.weekCell, outside && styles.outsideCell, isToday && { backgroundColor: soft }]}>
                <AgendaDayButton accessibilityRole="button" accessibilityLabel={`${date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}, ${items.filter((task) => !task.completed).length} pendientes, ${items.filter((task) => task.completed).length} completadas, ${dayHabits.length} hábitos${hasOverdue ? ', tareas atrasadas' : ''}`} accessibilityHint="Abrir las tareas de este día" onPress={() => router.navigate({ pathname: '/', params: { day, agendaView: effectiveView, agendaDate: dayKey(detailed ? anchor : month) } })} style={StyleSheet.absoluteFill} />
                <View pointerEvents="none" style={styles.dayHeader}><View style={[styles.dayNumberCircle, isToday && { backgroundColor: accent }]}><Text style={[styles.dayNumber, outside && styles.outsideNumber, isToday && styles.todayNumber]}>{date.getDate()}</Text></View></View>
                <View pointerEvents="box-none" style={styles.entries}>{shownTasks.map((task) => <AgendaTaskEntry key={task.id} task={task} day={day} detailed={detailed} now={now} onEdit={() => setEditingId(task.id)} />)}{items.length > taskLimit && <Text numberOfLines={1} style={styles.more}>+{items.length - taskLimit} más</Text>}{shownHabits.length > 0 && <View style={styles.habitEntries}>{shownHabits.map((habit) => <AgendaHabitEntry key={habit.id} habit={habit} day={day} today={today} detailed={detailed} onEdit={() => setEditingHabitId(habit.id)} />)}{dayHabits.length > habitLimit && <Text numberOfLines={1} style={[styles.more, { color: preferences.habits }]}>+{dayHabits.length - habitLimit} hábitos</Text>}</View>}</View>
              </View>;
            })}
          </View>)}
        </View>
        </View>
      </ScrollView>
    );
  }
  return <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
    <View style={styles.page}>
      <SectionTabs active="agenda" />
      <View style={styles.toolbar}>
        <View style={styles.monthBlock}><Text accessibilityRole="header" style={styles.monthTitle}>{monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)}</Text><Text style={styles.viewLabel}>{detailed ? (weekly ? 'Vista semanal' : `Vista de ${dayCount} días`) : 'Vista mensual'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={detailed ? (weekly ? "Volver a la semana actual" : "Volver a hoy") : "Volver al mes actual"} onPress={() => { setWeekAnchor(now); setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12)); }} style={styles.todayButton}><Text style={styles.todayText}>Hoy</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={detailed ? (weekly ? "Semana anterior" : `${dayCount} días anteriores`) : "Mes anterior"} onPress={() => changePeriod(-1)} style={styles.arrow}><MaterialIcons name="chevron-left" size={24} color={color('#202124')} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={detailed ? (weekly ? "Semana siguiente" : `${dayCount} días siguientes`) : "Mes siguiente"} onPress={() => changePeriod(1)} style={styles.arrow}><MaterialIcons name="chevron-right" size={24} color={color('#202124')} /></Pressable>
      </View>
      <View style={styles.viewSwitch}>{viewOptions.map(({ value, label }) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Vista ${label.toLowerCase()}`} accessibilityState={{ selected: effectiveView === value }} aria-pressed={effectiveView === value} onPress={() => changeView(value)} style={[styles.viewButton, effectiveView === value && { backgroundColor: soft }]}><Text style={[styles.viewButtonText, effectiveView === value && { color: accent }]}>{label}</Text></Pressable>)}</View>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!ready && !error && <ActivityIndicator color={accent} />}
      <AgendaPager enabled={mobile && effectiveView === '3'} pageKey={`${effectiveView}-${dayKey(weekAnchor)}`} onStep={changePeriod} renderNeighbor={renderCalendar}>
        {renderCalendar(0)}
      </AgendaPager>
      <View style={styles.legend}><View style={styles.overdueDot} /><Text style={styles.legendText}>Pendientes atrasadas</Text><Text style={styles.legendText}>· Completadas en gris</Text></View>
      {removedId && <View accessibilityLiveRegion="polite" style={styles.undoBar}><Text style={styles.undoMessage}>Tarea eliminada</Text><Pressable accessibilityRole="button" accessibilityLabel="Deshacer eliminación" onPress={undoDelete} style={styles.undoButton}><Text style={styles.undoText}>Deshacer</Text></Pressable></View>}
    </View>
    {editingTask && <TaskEditor key={editingTask.id} task={editingTask} lists={lists} initialListId={editingTask.listId} onSave={saveTask} onToggle={toggleTask} onStar={toggleStar} onDelete={removeTask} onClose={() => setEditingId(null)} />}
    {editingHabit && <HabitModal key={editingHabit.id} habit={editingHabit} today={today} onClose={() => setEditingHabitId(null)} onSave={(name, interval, description) => updateHabit(editingHabit.id, name, interval, description)} onToggle={(day) => toggleDay(editingHabit.id, day)} onDelete={() => deleteHabit(editingHabit.id)} />}
  </SafeAreaView>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color('#f8fafd') },
  page: { flex: 1, width: '100%', maxWidth: 1200, alignSelf: 'center', paddingBottom: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 2, paddingBottom: 14 },
  monthBlock: { flex: 1, minWidth: 0 }, monthTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 21, color: color('#202124') }, viewLabel: { fontFamily: 'Manrope-Regular', fontSize: 11, color: color('#80868b'), marginTop: 3 },
  todayButton: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: color('#e8f0fe') }, todayText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#1a73e8') }, arrow: { width: 36, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  viewSwitch: { flexDirection: 'row', alignSelf: 'flex-start', marginHorizontal: 12, marginBottom: 12, padding: 3, borderRadius: 12, borderWidth: 1, borderColor: color('#edf0f5') }, viewButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 }, viewButtonText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#80868b') },
  calendarBody: { flex: 1 }, weekCell: { paddingHorizontal: 5, paddingTop: 8 }, 
  undoBar: { position: 'absolute', left: 24, right: 24, bottom: 34, backgroundColor: color('#fff'), borderWidth: 1, borderColor: color('#edf0f5'), borderRadius: 16, paddingLeft: 16, paddingRight: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0px 4px 18px rgba(0,0,0,0.15)' }, undoMessage: { fontFamily: 'Manrope-Regular', fontSize: 14, color: color('#202124') }, undoButton: { paddingHorizontal: 14, paddingVertical: 16, borderRadius: 12 }, undoText: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: color('#1a73e8') },
  calendarScroll: { flex: 1, marginHorizontal: 6 }, calendarContent: { flexGrow: 1, minHeight: 440 },
  weekdays: { flexDirection: 'row', paddingBottom: 10 }, weekday: { flex: 1, textAlign: 'center', fontFamily: 'Manrope-Medium', fontSize: 11, color: color('#80868b') },
  grid: { flex: 1, minHeight: 400, borderTopWidth: 1, borderLeftWidth: 1, borderColor: color('#edf0f5'), borderRadius: 12, overflow: 'hidden' },
  week: { flex: 1, flexDirection: 'row', minHeight: 80 },
  cell: { flex: 1, minWidth: 0, paddingHorizontal: 3, paddingTop: 5, paddingBottom: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: color('#edf0f5'), backgroundColor: color('#fff'), overflow: 'hidden' },
  outsideCell: { backgroundColor: color('#f8fafd') }, dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 3, marginBottom: 4 }, dayNumberCircle: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, dayNumber: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#202124') }, outsideNumber: { color: color('#9aa0a6') }, todayNumber: { color: '#fff' },
  overdueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e53935', flexShrink: 0 },
  entries: { gap: 5 }, more: { fontFamily: 'Manrope-Regular', fontSize: 9, lineHeight: 12, color: color('#80868b'), paddingLeft: 3 },
  habitEntries: { gap: 5, paddingTop: 7, marginTop: 3, borderTopWidth: 1, borderColor: color('#edf0f5') },
  legend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 10, paddingHorizontal: 8 }, legendText: { fontFamily: 'Manrope-Regular', fontSize: 10, color: color('#80868b') }, error: { fontFamily: 'Manrope-Regular', fontSize: 12, color: color('#b3261e'), paddingHorizontal: 12, paddingBottom: 8 },
});
