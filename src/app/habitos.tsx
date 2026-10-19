import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import HabitStreak from '@/components/habit-streak';
import HabitHistory from '@/components/habit-history';
import HabitModal from '@/components/habit-modal';
import HabitsWelcome from '@/components/habits-welcome';
import { useAuth } from '@/auth/auth-provider';
import SectionTabs from '@/components/section-tabs';
import { useHabitGreeting } from '@/hooks/use-habit-greeting';
import { useHabits } from '@/hooks/use-habits';
import { dayKey, isScheduledDay } from '@/models/habit';

export default function HabitsScreen() {
  const greeting = useHabitGreeting();
  const { styles, color } = useSectionStyles(makeStyles, 'habits');
  const { habits, ready, error, addHabit, updateHabit, toggleDay, deleteHabit } = useHabits();
  const { session } = useAuth();
  const owner = session?.user.id ?? 'guest';
  const insets = useSafeAreaInsets();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [today, setToday] = useState(dayKey());
  useEffect(() => {
    const refresh = () => setToday(dayKey());
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener('change', refresh);
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const current = habits.find((habit) => habit.id === selected);
  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}><View style={styles.page}>
    <View style={styles.heading}><Text style={styles.title}>{greeting.title}</Text><Text style={styles.subtitle}>{greeting.subtitle}</Text></View>
    {error && <Text style={styles.error}>{error}</Text>}
    <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
      {!habits.length && <View style={styles.empty}><MaterialIcons name="calendar-today" size={44} color={color('#188038')} /><Text style={styles.emptyTitle}>{ready ? 'Empezá con un hábito.' : 'Cargando hábitos…'}</Text><Text style={styles.subtitle}>Cada punto cuenta una pequeña victoria.</Text></View>}
      {habits.map((habit) => {
        const checked = habit.completedDays.includes(today);
        return <Pressable key={habit.id} accessibilityRole="button" accessibilityLabel={`Ver historial de ${habit.name}`} onPress={() => setSelected(habit.id)} style={styles.card}>
          <View style={styles.cardTop}><View style={styles.nameBlock}><Text style={styles.name}>{habit.name}</Text>{habit.description ? <Text style={styles.description} numberOfLines={1}>{habit.description}</Text> : null}<Text style={styles.frequency}>{habit.intervalDays === 1 ? 'Cada día' : `Cada ${habit.intervalDays} días`}{isScheduledDay(habit, today) ? ' · Para hoy' : ''}</Text></View><HabitStreak habit={habit} today={today} /><Pressable accessibilityRole="checkbox" accessibilityLabel={`Completar hoy: ${habit.name}`} aria-checked={checked} accessibilityState={{ checked }} hitSlop={8} onPress={(event) => { event.stopPropagation(); toggleDay(habit.id, today); }} style={[styles.check, checked && styles.checked]}><MaterialIcons name={checked ? 'check' : 'add'} size={22} color={checked ? '#fff' : color('#188038')} /></Pressable></View>
          <HabitHistory habit={habit} today={today} />
        </Pressable>;
      })}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Nuevo hábito" disabled={!ready} onPress={() => setCreating(true)} style={[styles.newButton, { bottom: 70 + Math.max(insets.bottom, 8) }, !ready && { opacity: 0.5 }]}><MaterialIcons name="add" size={25} color="#fff" /><Text style={styles.newText}>Nuevo hábito</Text></Pressable>
    <SectionTabs active="habits" />
    {creating && <HabitModal today={today} onClose={() => setCreating(false)} onSave={addHabit} />}
    {current && <HabitModal key={current.id} habit={current} onDelete={() => deleteHabit(current.id)} today={today} onClose={() => setSelected(null)} onSave={(name, interval, description) => updateHabit(current.id, name, interval, description)} onToggle={(day) => toggleDay(current.id, day)} />}
    <HabitsWelcome key={owner} owner={owner} onCreate={() => setCreating(true)} />
  </View></SafeAreaView>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color('#f8fafd') }, page: { flex: 1, width: '100%', maxWidth: 660, alignSelf: 'center' }, scroll: { flex: 1 },
  heading: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 22 }, title: { fontFamily: 'Manrope-SemiBold', fontSize: 30, color: color('#202124'), fontWeight: 'normal', letterSpacing: -1 }, subtitle: { fontFamily: 'Manrope-Regular', fontSize: 13, color: color('#80868b'), marginTop: 9, lineHeight: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 150, gap: 16 }, card: { padding: 20, backgroundColor: color('#fff'), borderRadius: 24, borderWidth: 1, borderColor: color('#e7eee9') },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }, nameBlock: { flex: 1 }, name: { fontFamily: 'Manrope-SemiBold', fontSize: 19, fontWeight: 'normal', color: color('#253c2d') }, frequency: { fontFamily: 'Manrope-Regular', fontSize: 12, color: color('#7c8980'), marginTop: 6 },
  description: { fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 18, color: color('#7c8980'), marginTop: 3 },
  check: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: color('#a9cbb3'), alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: color('#34a853'), borderColor: color('#34a853') },
  empty: { alignItems: 'center', paddingTop: 65, paddingHorizontal: 15 }, emptyTitle: { fontFamily: 'Manrope-Regular', fontSize: 19, color: color('#5f6368'), marginTop: 22 },
  newButton: { position: 'absolute', bottom: 22, right: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: color('#188038'), borderRadius: 20, paddingHorizontal: 20, paddingVertical: 18, elevation: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }, newText: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 15, fontWeight: 'normal' }, error: { color: color('#b3261e'), paddingHorizontal: 24, paddingBottom: 12 },
});
