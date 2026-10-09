import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import TaskEditor from '@/components/task-editor';
import TaskRow from '@/components/task-row';
import SectionTabs from '@/components/section-tabs';
import { useTaskGreeting } from '@/hooks/use-task-greeting';
import { useTasks } from '@/hooks/use-tasks';
import { compareTaskDueDate, matchesTaskDate, type TaskDateFilter, type Task } from '@/models/task';

export default function TasksScreen() {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  const { tasks, ready, error, saveTask, toggleTask, toggleStar, deleteTask } = useTasks();
  const greeting = useTaskGreeting();
  const insets = useSafeAreaInsets();
  const [editor, setEditor] = useState<{ task?: Task } | null>(null);
  const [arrival, setArrival] = useState<{ id: string; completed: boolean } | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [starredOnly, setStarredOnly] = useState(false);
  const [filter, setFilter] = useState<TaskDateFilter>('all');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener('change', refresh);
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!arrival) return;
    const timer = setTimeout(() => setArrival(null), 1200);
    return () => clearTimeout(timer);
  }, [arrival]);
  function moveTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setArrival({ id, completed: !task.completed });
    if (!task.completed) setShowCompleted(true);
    toggleTask(id);
  }
  const allPending = tasks.filter((task) => !task.completed);
  const todayCount = allPending.filter((task) => matchesTaskDate(task, 'today', now)).length;
  const weekCount = allPending.filter((task) => matchesTaskDate(task, 'week', now)).length;
  const pending = allPending.filter((task) => matchesTaskDate(task, filter, now) && (!starredOnly || task.starred)).sort(compareTaskDueDate);
  const completed = tasks.filter((task) => task.completed && matchesTaskDate(task, filter, now) && (!starredOnly || task.starred)).sort(compareTaskDueDate);
  const today = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.page}>
        <SectionTabs active="tasks" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: 116 + insets.bottom }]}>
          <View style={styles.heading}>
            <Text style={styles.date}>{today.charAt(0).toUpperCase() + today.slice(1)}</Text>
            <Text style={styles.title}>{greeting.title}</Text>
            <Text style={styles.subtitle}>{greeting.subtitle}</Text>
          </View>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <View style={styles.listHeader}><Text style={styles.listTitle}>Mis tareas</Text><View style={styles.filters}>
            <Pressable accessibilityRole="button" accessibilityLabel="Todas las tareas" aria-pressed={filter === 'all'} onPress={() => setFilter('all')} style={[styles.filterButton, filter === 'all' && styles.filterSelected]}><Text style={[styles.counterText, filter === 'all' && styles.filterSelectedText]}>Todo ({allPending.length})</Text></Pressable>
            {([{ value: 'today', label: 'Hoy', count: todayCount }, { value: 'week', label: 'Esta semana', count: weekCount }] as const).map(({ value, label, count }) => <Pressable key={value} accessibilityRole="button" aria-pressed={filter === value} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(filter === value ? 'all' : value)} style={[styles.filterButton, filter === value && styles.filterSelected]}><Text style={[styles.counterText, filter === value && styles.filterSelectedText]}>{label} ({count})</Text></Pressable>)}
            <Pressable accessibilityRole="button" accessibilityLabel="Filtrar por estrella" aria-pressed={starredOnly} accessibilityState={{ selected: starredOnly }} onPress={() => setStarredOnly(!starredOnly)} style={[styles.filterButton, styles.starFilter, starredOnly && styles.filterSelected]}><MaterialIcons name={starredOnly ? 'star' : 'star-border'} size={19} color={color(starredOnly ? '#1a73e8' : '#80868b')} /></Pressable>
          </View></View>
          {!ready && !error && <ActivityIndicator color={color('#1a73e8')} style={styles.loading} />}
          {ready && pending.length > 0 && <View style={styles.card}>{pending.map((task, index) => <TaskRow key={task.id} task={task} animateArrival={arrival?.id === task.id && arrival.completed === task.completed} onToggle={() => moveTask(task.id)} onEdit={() => setEditor({ task })} onStar={() => toggleStar(task.id)} last={index === pending.length - 1} />)}</View>}
          {ready && pending.length === 0 && <View style={styles.empty}>
            <View style={styles.emptyIllustration}>
              <View style={styles.illustrationCard}>
                <View style={styles.illustrationLine}><View style={styles.illustrationCheck}><MaterialIcons name="check" size={15} color={color('#1a73e8')} /></View><View style={[styles.illustrationBar, { width: 58 }]} /></View>
                <View style={styles.illustrationLine}><View style={styles.illustrationCheck}><MaterialIcons name="check" size={15} color={color('#1a73e8')} /></View><View style={[styles.illustrationBar, { width: 42 }]} /></View>
                <View style={styles.illustrationLine}><View style={styles.illustrationCircle} /><View style={[styles.illustrationBar, { width: 51, backgroundColor: '#e1e9f4' }]} /></View>
              </View>
              <View style={styles.sparkle}><MaterialIcons name="auto-awesome" size={22} color={color('#e2b44b')} /></View>
            </View>
            <Text style={styles.emptyTitle}>{starredOnly ? 'Sin tareas destacadas en este período.' : filter !== 'all' ? (filter === 'today' ? 'Sin pendientes para hoy.' : 'Sin pendientes esta semana.') : completed.length ? 'Todo al día.' : 'Tu día, más liviano.'}</Text>
            <Text style={styles.emptySubtitle}>{starredOnly ? 'Agregá una estrella a tus tareas o desactivá el filtro de estrella.' : filter !== 'all' ? 'Tocá Todo para ver las tareas de cualquier fecha.' : completed.length ? 'Completaste todas tus tareas. Buen trabajo.' : 'Anotá eso que tenés en mente.\nEl primer paso es una nueva tarea.'}</Text>
          </View>}
          {completed.length > 0 && <View style={styles.completedSection}>
            <Pressable onPress={() => setShowCompleted(!showCompleted)} accessibilityRole="button" accessibilityState={{ expanded: showCompleted }} style={styles.completedHeader}>
              <MaterialIcons name={showCompleted ? 'keyboard-arrow-down' : 'keyboard-arrow-right'} size={21} color={color('#80868b')} />
              <Text style={styles.completedLabel}>Completadas</Text><Text style={styles.completedCount}>{completed.length}</Text>
            </Pressable>
            {showCompleted && <View style={styles.card}>{completed.map((task, index) => <TaskRow key={task.id} task={task} animateArrival={arrival?.id === task.id && arrival.completed === task.completed} onToggle={() => moveTask(task.id)} onEdit={() => setEditor({ task })} onStar={() => toggleStar(task.id)} last={index === completed.length - 1} />)}</View>}
          </View>}
        </ScrollView>
        <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable disabled={!ready} onPress={() => setEditor({})} accessibilityRole="button" accessibilityLabel="Nueva tarea" style={[styles.addButton, !ready && styles.disabled]}>
            <MaterialIcons name="add" size={24} color="#fff" /><Text style={styles.addText}>Nueva tarea</Text>
          </Pressable>
        </View>
      </View>
      {editor && <TaskEditor task={editor.task ? tasks.find((task) => task.id === editor.task?.id) ?? editor.task : undefined} onToggle={moveTask} onStar={toggleStar} onSave={saveTask} onDelete={deleteTask} onClose={() => setEditor(null)} />}
    </SafeAreaView>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color('#f8fafd') },
  page: { flex: 1, width: '100%', maxWidth: 660, alignSelf: 'center' },
  scroll: { paddingHorizontal: 24 },
  heading: { paddingTop: 16, paddingBottom: 22 },
  date: { color: color('#80868b'), fontSize: 12, marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 38, color: color('#202124'), fontWeight: '600', letterSpacing: -1.2 },
  subtitle: { fontSize: 13, lineHeight: 19, color: color('#80868b'), marginTop: 5 },
  listHeader: { gap: 12, marginBottom: 16 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  filterButton: { paddingHorizontal: 8, minHeight: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: color('#f3f6f4'), borderWidth: 1, borderColor: color('#edf0f5') },
  starFilter: { minWidth: 32, alignItems: 'center', paddingHorizontal: 6 },
  filterSelected: { backgroundColor: color('#e8f0fe'), borderColor: color('#1a73e8') },
  filterSelectedText: { color: color('#1a73e8') },
  listTitle: { color: color('#3c4043'), fontSize: 16, fontWeight: '600' },
  counterText: { fontSize: 11, color: color('#6c7d96'), fontWeight: '500' },
  card: { backgroundColor: color('#fff'), borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: color('#edf0f5') },
  loading: { padding: 48 },
  error: { color: color('#b3261e'), backgroundColor: color('#fce8e6'), padding: 14, borderRadius: 12, fontSize: 13, marginBottom: 18 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyIllustration: { width: 156, height: 145, backgroundColor: color('#edf3fd'), borderRadius: 78, alignItems: 'center', justifyContent: 'center', marginBottom: 27 },
  illustrationCard: { padding: 16, gap: 12, backgroundColor: color('#fff'), borderRadius: 14, transform: [{ rotate: '-8deg' }], boxShadow: '0px 6px 18px rgba(60,100,170,0.09)' },
  illustrationLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  illustrationCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: color('#e8f0fe'), alignItems: 'center', justifyContent: 'center' },
  illustrationCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: color('#c2d3ed') },
  illustrationBar: { height: 5, borderRadius: 3, backgroundColor: color('#b5cbec') },
  sparkle: { position: 'absolute', right: 1, top: 10, transform: [{ rotate: '10deg' }] },
  emptyTitle: { fontSize: 18, color: color('#5f6368'), fontWeight: '500' },
  emptySubtitle: { textAlign: 'center', color: color('#9299a3'), fontSize: 13, lineHeight: 21, marginTop: 10 },
  completedSection: { marginTop: 25 },
  completedHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, marginBottom: 6 },
  completedLabel: { fontSize: 12, color: color('#80868b'), fontWeight: '500' },
  completedCount: { fontSize: 11, color: color('#9aa0a6') },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 18, alignItems: 'flex-end' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 18, backgroundColor: color('#1a73e8'), paddingHorizontal: 21, paddingVertical: 17, boxShadow: '0px 5px 18px rgba(26,115,232,0.22)' },
  addText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
