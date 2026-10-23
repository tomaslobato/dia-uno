import Pressable from '@/components/feedback-pressable';
import { accentTextColor, useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgendaDayButton } from '@/components/agenda-pager';
import AgendaDayCarousel from '@/components/agenda-day-carousel';
import TaskListOptions from '@/components/task-list-options';
import TaskListCreate from '@/components/task-list-create';
import DraggableTaskList from '@/components/draggable-task-list';
import TaskEditor from '@/components/task-editor';
import TaskRow from '@/components/task-row';
import TaskSortOptions from '@/components/task-sort-options';
import { SectionEntrance } from '@/components/section-motion';
import { useTaskGreeting } from '@/hooks/use-task-greeting';
import { useTaskDeletion } from '@/hooks/use-task-deletion';
import { useTaskSort } from '@/hooks/use-task-sort';
import { router, useLocalSearchParams } from 'expo-router';
import { agendaDayLabel, shiftAgendaDay, agendaTasksForDay, validAgendaDay } from '@/models/agenda';
import { localDay } from '@/models/habit';
import { useTasks } from '@/hooks/use-tasks';
import { compareTaskDueDate, matchesTaskDate, staysInTaskSchedule, taskDateSection, type Task } from '@/models/task';

export default function TasksScreen() {
  const { day, agendaView, agendaDate } = useLocalSearchParams<{ day?: string; agendaView?: string; agendaDate?: string }>();
  // Daily agenda view was removed — day deep-links open the weekly calendar instead.
  useEffect(() => {
    if (!validAgendaDay(day)) return;
    router.replace({ pathname: '/agenda', params: { view: 'week', date: day } });
  }, [day]);
  const agendaDay = null;
  const fixedMonthKey = agendaDay ? (validAgendaDay(agendaDate) ? agendaDate : agendaDay) : null;
  const fixedMonth = fixedMonthKey ? localDay(fixedMonthKey).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : '';
  const { styles, color, preferences } = useSectionStyles(makeStyles, 'tasks');
  const { tasks, lists, addList, renameList, deleteList, ready, error, saveTask, toggleTask, toggleStar, deleteTask } = useTasks();
  const { removedId, removeTask, undoDelete } = useTaskDeletion(deleteTask);
  const visibleTasks = useMemo(() => tasks.filter((task) => task.id !== removedId), [tasks, removedId]);
  const [listId, setListId] = useState('all');
  const [managingList, setManagingList] = useState<string | null>(null);
  const managedList = useMemo(() => lists.find((list) => list.id === managingList), [lists, managingList]);
  const [creatingList, setCreatingList] = useState(false);
  const selectedList = useMemo(() => lists.find((list) => list.id === listId), [lists, listId]);
  const listTasks = useMemo(() => agendaDay ? agendaTasksForDay(visibleTasks, agendaDay, true) : !selectedList ? visibleTasks : visibleTasks.filter((task) => task.listId === selectedList.id), [agendaDay, visibleTasks, selectedList]);
  const greeting = useTaskGreeting();
  const insets = useSafeAreaInsets();
  const [editor, setEditor] = useState<{ task?: Task } | null>(null);
  const [arrival, setArrival] = useState<{ id: string; completed: boolean } | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedDayListHeight, setSelectedDayListHeight] = useState(500);
  const [reordering, setReordering] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const starredOnly = !agendaDay && listId === 'starred';
  const sortKey = agendaDay ? `day:${agendaDay}` : starredOnly ? 'starred' : selectedList ? `list:${selectedList.id}` : 'all';
  const { mode: sortMode, setMode: setSortMode, reorder, sortPending } = useTaskSort(sortKey);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 60000);
    let dayTimer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      dayTimer = setTimeout(() => { refresh(); scheduleMidnight(); }, midnight.getTime() - Date.now() + 50);
    };
    scheduleMidnight();
    const subscription = AppState.addEventListener('change', refresh);
      return () => { clearInterval(timer); clearTimeout(dayTimer); subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!arrival) return;
    const timer = setTimeout(() => setArrival(null), 1200);
    return () => clearTimeout(timer);
  }, [arrival]);
  function moveTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const staysToday = matchesTaskDate(task, 'today', new Date());
    setArrival(staysToday ? null : { id, completed: !task.completed });
    if (!task.completed && !staysToday) setShowCompleted(true);
    toggleTask(id);
  }
  const pendingRaw = useMemo(() => listTasks.filter((task) => staysInTaskSchedule(task, now) && (!starredOnly || task.starred)), [listTasks, now, starredOnly]);
  const pending = useMemo(() => agendaDay ? [...pendingRaw].sort(compareTaskDueDate) : sortPending(pendingRaw), [agendaDay, pendingRaw, sortPending]);
  const completed = useMemo(() => listTasks.filter((task) => !staysInTaskSchedule(task, now) && (!starredOnly || task.starred)).sort(compareTaskDueDate), [listTasks, now, starredOnly]);
  const dateSections = useMemo(() => {
    if (agendaDay || sortMode !== 'date') return null;
    const result: { title: string; tasks: Task[] }[] = [];
    for (const task of pending) {
      const title = taskDateSection(task, now);
      const previous = result[result.length - 1];
      if (previous?.title === title) previous.tasks.push(task);
      else result.push({ title, tasks: [task] });
    }
    return result;
  }, [agendaDay, sortMode, pending, now]);
  const today = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const manualSort = !agendaDay && sortMode === 'manual';
  const dateSort = !agendaDay && sortMode === 'date';
  function renderTaskRow(task: Task, last: boolean, drag?: { isDragging: boolean; handleHandlers: object }) {
    return <TaskRow key={task.id} task={task} clockKey={Math.floor(now.getTime() / 60000)} swipeDeleteEnabled={!agendaDay && !manualSort && !drag?.isDragging} keepInPlace={matchesTaskDate(task, 'today', now)} listName={agendaDay || !selectedList ? lists.find((list) => list.id === task.listId)?.name : undefined} animateArrival={arrival?.id === task.id && arrival.completed === task.completed} onToggle={() => moveTask(task.id)} onEdit={() => setEditor({ task })} onStar={() => toggleStar(task.id)} onDelete={removeTask} isDragging={drag?.isDragging} dragHandleHandlers={drag?.handleHandlers} dueMode={dateSort ? 'section' : 'full'} last={last} />;
  }

  const listContent = (
        <ScrollView key={agendaDay ?? 'tasks'} scrollEnabled={!reordering} showsVerticalScrollIndicator={false} contentContainerStyle={[agendaDay ? styles.dayScroll : styles.scroll, { paddingBottom: 116 + insets.bottom }]}>
          <View onLayout={agendaDay ? (event) => { const height = Math.round(event.nativeEvent.layout.height); setSelectedDayListHeight((current) => current === height ? current : height); } : undefined} style={agendaDay ? [styles.dayCard, { borderColor: accentTextColor(preferences.agenda, preferences.dark) }] : undefined}>
          <SectionEntrance section="/" order={0}>{agendaDay ? <AgendaDayButton accessibilityRole="button" accessibilityLabel="Volver al calendario" accessibilityHint="Toca el título o la fecha para abrir Agenda" onPress={() => router.navigate({ pathname: '/agenda', params: { view: agendaView, date: agendaDate } })} style={styles.dayHeading}>
            <View style={[styles.dayNumber, agendaDay && { backgroundColor: preferences.agenda }]}><Text style={[styles.dayNumberText, agendaDay && { color: '#fff' }]}>{localDay(agendaDay).getDate()}</Text></View>
            <Text accessibilityRole="header" style={styles.dayTitle}>{agendaDayLabel(agendaDay, now)}</Text>
          </AgendaDayButton> : <View style={[styles.heading, !preferences.showGreetings && styles.headingCompact]}>
            <Text style={[styles.date, !preferences.showGreetings && styles.dateLarge]}>{today.charAt(0).toUpperCase() + today.slice(1)}</Text>
            {preferences.showGreetings && <><Text style={styles.title}>{greeting.title}</Text>
            <Text style={styles.subtitle}>{greeting.subtitle}</Text></>}
          </View>}</SectionEntrance>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {!agendaDay && <SectionEntrance section="/" order={1}><View style={styles.listHeader}>
            <View style={styles.listSelection}>
              <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled" style={styles.listScroll} contentContainerStyle={styles.listChoices}>
                <Pressable accessibilityRole="button" accessibilityLabel="Tareas con estrella" aria-pressed={starredOnly} onPress={() => setListId('starred')} style={[styles.listChoice, styles.starChoice, starredOnly && styles.filterSelected]}><MaterialIcons name="star" size={20} color={color(starredOnly ? '#1a73e8' : '#80868b')} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Lista: Todo" aria-pressed={listId === 'all'} onPress={() => setListId('all')} style={[styles.listChoice, listId === 'all' && styles.filterSelected]}><Text style={[styles.listTitle, listId === 'all' && styles.filterSelectedText]}>Todo</Text></Pressable>
                {lists.map((list) => <Pressable key={list.id} accessibilityRole="button" accessibilityLabel={`Lista: ${list.name}`} accessibilityState={{ selected: listId === list.id }} aria-pressed={listId === list.id} accessibilityHint="Mantén pulsada para renombrar o eliminar la lista" onLongPress={() => setManagingList(list.id)} onPress={() => setListId(list.id)} style={[styles.listChoice, listId === list.id && styles.filterSelected]}><Text numberOfLines={1} style={[styles.listTitle, listId === list.id && styles.filterSelectedText]}>{list.name}</Text></Pressable>)}
                <Pressable disabled={!ready} accessibilityRole="button" accessibilityLabel="Nueva lista" onPress={() => setCreatingList(true)} style={styles.listAdd}><MaterialIcons name="add" size={23} color={color('#1a73e8')} /></Pressable>
              </ScrollView>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Ordenar tareas" accessibilityHint={sortMode === 'date' ? 'Orden actual: fecha' : 'Orden actual: manual'} onPress={() => setSortMenuOpen(true)} style={styles.sortToggle}>
              <MaterialIcons name="sort" size={22} color={color('#80868b')} />
            </Pressable>
          </View></SectionEntrance>}
          {!ready && !error && <ActivityIndicator color={color('#1a73e8')} style={styles.loading} />}
          {ready && pending.length > 0 && (dateSections
            ? dateSections.map((section, sectionIndex) => <SectionEntrance key={section.title} section="/" order={sectionIndex + 2}><View style={styles.dateSection}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.card}>{section.tasks.map((task, index) => renderTaskRow(task, index === section.tasks.length - 1))}</View>
              </View></SectionEntrance>)
            : <SectionEntrance section="/" order={2}><View style={[styles.card, agendaDay && styles.dayInnerCard]}>
              {manualSort
                ? <DraggableTaskList tasks={pending} enabled onReorder={reorder} onDraggingChange={setReordering} renderItem={(task, _index, last, drag) => renderTaskRow(task, last, drag)} />
                : pending.map((task, index) => renderTaskRow(task, index === pending.length - 1))}
            </View></SectionEntrance>)}
          {ready && pending.length === 0 && <SectionEntrance section="/" order={2}><View style={styles.empty}>
            <View style={styles.emptyIllustration}>
              <View style={styles.illustrationCard}>
                <View style={styles.illustrationLine}><View style={styles.illustrationCheck}><MaterialIcons name="check" size={15} color={color('#1a73e8')} /></View><View style={[styles.illustrationBar, { width: 58 }]} /></View>
                <View style={styles.illustrationLine}><View style={styles.illustrationCheck}><MaterialIcons name="check" size={15} color={color('#1a73e8')} /></View><View style={[styles.illustrationBar, { width: 42 }]} /></View>
                <View style={styles.illustrationLine}><View style={styles.illustrationCircle} /><View style={[styles.illustrationBar, { width: 51, backgroundColor: '#e1e9f4' }]} /></View>
              </View>
              <View style={styles.sparkle}><MaterialIcons name="auto-awesome" size={22} color={color('#e2b44b')} /></View>
            </View>
            <Text style={styles.emptyTitle}>{agendaDay ? (completed.length ? 'Todo al día.' : 'No hay tareas para este día.') : starredOnly ? 'Sin tareas con estrella.' : completed.length ? 'Todo al día.' : 'Tu día, más liviano.'}</Text>
            <Text style={styles.emptySubtitle}>{agendaDay ? (completed.length ? 'Completaste las tareas de este día.' : 'Puedes añadir una tarea para esta fecha.') : starredOnly ? 'Marca tus tareas con una estrella para verlas aquí.' : completed.length ? 'Completaste todas tus tareas. Buen trabajo.' : 'Anotá eso que tenés en mente.\nEl primer paso es una nueva tarea.'}</Text>
          </View></SectionEntrance>}
          {completed.length > 0 && <SectionEntrance section="/" order={6}><View style={styles.completedSection}>
            <Pressable onPress={() => setShowCompleted(!showCompleted)} accessibilityRole="button" accessibilityState={{ expanded: showCompleted }} style={styles.completedHeader}>
              <MaterialIcons name={showCompleted ? 'keyboard-arrow-down' : 'keyboard-arrow-right'} size={21} color={color('#80868b')} />
              <Text style={styles.completedLabel}>Completadas</Text><Text style={styles.completedCount}>{completed.length}</Text>
            </Pressable>
            {showCompleted && <View style={[styles.card, agendaDay && styles.dayInnerCard]}>{completed.map((task, index) => <TaskRow key={task.id} task={task} clockKey={Math.floor(now.getTime() / 60000)} swipeDeleteEnabled={!agendaDay} keepInPlace={matchesTaskDate(task, 'today', now)} listName={agendaDay || !selectedList ? lists.find((list) => list.id === task.listId)?.name : undefined} animateArrival={arrival?.id === task.id && arrival.completed === task.completed} onToggle={() => moveTask(task.id)} onEdit={() => setEditor({ task })} onStar={() => toggleStar(task.id)} onDelete={removeTask} last={index === completed.length - 1} />)}</View>}
          </View></SectionEntrance>}
          </View>
        </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.page}>
        {agendaDay && <View pointerEvents="none" style={styles.fixedMonth}><Text style={styles.fixedMonthTitle}>{fixedMonth.charAt(0).toUpperCase() + fixedMonth.slice(1)}</Text></View>}
        {agendaDay ? <AgendaDayCarousel day={agendaDay} lists={lists} tasks={visibleTasks} now={now} selectedListHeight={selectedDayListHeight} onStep={(direction) => { setArrival(null); setShowCompleted(false); router.setParams({ day: shiftAgendaDay(agendaDay, direction) }); }}>{listContent}</AgendaDayCarousel> : listContent}

        <SectionEntrance section="/" order={7} style={{ position: 'absolute', left: 0, right: 0, bottom: 11 }}><View pointerEvents="box-none" style={styles.bottom}>
          {removedId ? <View accessibilityLiveRegion="polite" style={styles.undoBar}>
            <Text style={styles.undoMessage} numberOfLines={1}>Tarea eliminada</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Deshacer eliminación" onPress={undoDelete} style={styles.undoButton}><Text style={styles.undoText}>Deshacer</Text></Pressable>
          </View> : <View style={styles.bottomSpacer} />}
          <Pressable disabled={!ready} onPress={() => setEditor({})} accessibilityRole="button" accessibilityLabel="Nueva tarea" style={[styles.addButton, agendaDay && { backgroundColor: preferences.agenda, boxShadow: `0px 5px 18px ${preferences.agenda}38` }, !ready && styles.disabled]}>
            <MaterialIcons name="add" size={28} color="#fff" />
          </Pressable>
        </View></SectionEntrance>
      </View>
      {managedList && <TaskListOptions key={managedList.id} list={managedList} onClose={() => setManagingList(null)} onRename={(name) => { renameList(managedList.id, name); setManagingList(null); }} onDelete={() => { deleteList(managedList.id); if (listId === managedList.id) setListId('all'); setManagingList(null); }} />}
      {creatingList && <TaskListCreate onClose={() => setCreatingList(false)} onCreate={(name) => { const id = addList(name); if (id) { setListId(id); setCreatingList(false); } }} />}
      {sortMenuOpen && <TaskSortOptions mode={sortMode} onClose={() => setSortMenuOpen(false)} onSelect={(mode) => mode === 'manual' ? setSortMode('manual', [...pendingRaw].sort(compareTaskDueDate)) : setSortMode('date')} />}
      {editor && <TaskEditor lists={lists} initialDate={agendaDay ? localDay(agendaDay) : undefined} initialListId={agendaDay ? null : selectedList?.id ?? null} task={editor.task ? tasks.find((task) => task.id === editor.task?.id) ?? editor.task : undefined} onToggle={moveTask} onStar={toggleStar} onSave={saveTask} onDelete={removeTask} onClose={() => setEditor(null)} />}
    </SafeAreaView>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color('#f8fafd') },
  page: { flex: 1, width: '100%', alignSelf: 'center', ...Platform.select({ web: { maxWidth: 660 }, default: {} }) },
  scroll: { paddingTop: 24, ...Platform.select({ web: { paddingHorizontal: 24 }, default: { paddingHorizontal: 0 } }) },
  dayScroll: { paddingHorizontal: 0, paddingTop: 24 }, dayCard: { minHeight: 500, marginHorizontal: 8, borderWidth: 1.5, borderRadius: 18, overflow: 'hidden', backgroundColor: color('#fff') }, dayInnerCard: { borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' }, dayNumber: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, dayNumberText: { fontFamily: 'Manrope-SemiBold', fontSize: 19, lineHeight: 25, color: color('#202124') },
  dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }, dayTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 26, lineHeight: 34, color: color('#202124') },
  fixedMonth: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 6 }, fixedMonthTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 30, lineHeight: 38, color: color('#202124'), letterSpacing: -1 },
  heading: { paddingTop: 24, paddingBottom: 22, paddingHorizontal: 24 },
  headingCompact: { paddingBottom: 12 },
  date: { color: color('#80868b'), fontFamily: 'Manrope-Regular', fontSize: 12, marginBottom: 8 },
  dateLarge: { fontFamily: 'Manrope-SemiBold', fontSize: 28, lineHeight: 36, color: color('#202124'), marginBottom: 0, letterSpacing: -1 },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 30, lineHeight: 38, color: color('#202124'), fontWeight: 'normal', letterSpacing: -1.2 },
  subtitle: { fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 19, color: color('#80868b'), marginTop: 5 },
  listSelection: { flex: 1, minWidth: 0, overflow: 'hidden' }, listScroll: { width: '100%', minWidth: 0, flexGrow: 0 }, listChoices: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingRight: 4 }, listChoice: { flexShrink: 0, maxWidth: 220, height: 36, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, listAdd: { flexShrink: 0, width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: color('#e8f0fe') },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 16, paddingLeft: 24, paddingRight: 16 },
  starChoice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortToggle: { flexShrink: 0, width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  filterSelected: { backgroundColor: color('#e8f0fe'), borderColor: color('#1a73e8') },
  filterSelectedText: { color: color('#185abc') },
  listTitle: { color: color('#3c4043'), fontFamily: 'Manrope-SemiBold', fontSize: 15, fontWeight: 'normal' },
  dateSection: { marginBottom: 12 },
  sectionTitle: { color: color('#80868b'), fontFamily: 'Manrope-Medium', fontSize: 12, fontWeight: 'normal', marginBottom: 6, marginLeft: 24 },
  card: { backgroundColor: 'transparent', overflow: 'visible' },
  loading: { padding: 48 },
  error: { color: color('#b3261e'), backgroundColor: color('#fce8e6'), padding: 14, borderRadius: 12, fontFamily: 'Manrope-Regular', fontSize: 13, marginBottom: 18, marginHorizontal: 24 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIllustration: { width: 156, height: 145, backgroundColor: color('#edf3fd'), borderRadius: 78, alignItems: 'center', justifyContent: 'center', marginBottom: 27 },
  illustrationCard: { padding: 16, gap: 12, backgroundColor: color('#fff'), borderRadius: 14, transform: [{ rotate: '-8deg' }], boxShadow: '0px 6px 18px rgba(60,100,170,0.09)' },
  illustrationLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  illustrationCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: color('#e8f0fe'), alignItems: 'center', justifyContent: 'center' },
  illustrationCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: color('#c2d3ed') },
  illustrationBar: { height: 5, borderRadius: 3, backgroundColor: color('#b5cbec') },
  sparkle: { position: 'absolute', right: 1, top: 10, transform: [{ rotate: '10deg' }] },
  emptyTitle: { fontFamily: 'Manrope-Medium', fontSize: 18, color: color('#5f6368'), fontWeight: 'normal' },
  emptySubtitle: { textAlign: 'center', color: color('#9299a3'), fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 21, marginTop: 10 },
  completedSection: { marginTop: 25 },
  completedHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 24, marginBottom: 6 },
  completedLabel: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#80868b'), fontWeight: 'normal' },
  completedCount: { fontFamily: 'Manrope-Regular', fontSize: 11, color: color('#9aa0a6') },
  undoBar: { flex: 1, minWidth: 0, backgroundColor: color('#fff'), borderWidth: 1, borderColor: color('#edf0f5'), borderRadius: 16, paddingLeft: 14, paddingRight: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0px 4px 18px rgba(0,0,0,0.15)' },
  undoMessage: { flexShrink: 1, fontFamily: 'Manrope-Regular', fontSize: 14, color: color('#202124') },
  undoButton: { paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12 },
  undoText: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: color('#1a73e8') },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  bottomSpacer: { flex: 1 },
  addButton: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color('#1a73e8'), boxShadow: '0px 5px 18px rgba(26,115,232,0.22)' },
  disabled: { opacity: 0.5 },
});
