import Pressable from '@/components/feedback-pressable';
import HabitCompleteButton from '@/components/habit-complete-button';
import HabitHistory from '@/components/habit-history';
import HabitModal from '@/components/habit-modal';
import HabitStreak from '@/components/habit-streak';
import HabitSymbolView from '@/components/habit-symbol';
import { SectionEntrance } from '@/components/section-motion';
import { useHabitGreeting } from '@/hooks/use-habit-greeting';
import { useHabits } from '@/hooks/use-habits';
import { dayKey, habitGoalProgressLabel, localDay } from '@/models/habit';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function mixHex(base: string, tint: string, amount: number) {
  const parse = (value: string) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
  const [br, bg, bb] = parse(base);
  const [tr, tg, tb] = parse(tint);
  const mix = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return `#${[mix(br, tr), mix(bg, tg), mix(bb, tb)].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function habitCardColors(accent: string): readonly [string, string, string] {
  return [
    mixHex('#0a0a0c', accent, 0.06),
    mixHex('#050506', accent, 0.015),
    '#000000',
  ] as const;
}

export default function HabitsScreen() {
  const greeting = useHabitGreeting();
  const { styles, color, preferences } = useSectionStyles(makeStyles, 'habits');
  const { habits, ready, error, addHabit, updateHabit, toggleDay, deleteHabit } = useHabits();
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
  const dateLabel = localDay(today).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateText = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}><View style={styles.page}>
    <SectionEntrance section="/habitos" order={0}><View style={[styles.heading, !preferences.showGreetings && styles.headingCompact]}>
      <Text style={[styles.date, !preferences.showGreetings && styles.dateLarge]}>{dateText}</Text>
      {preferences.showGreetings && <><Text numberOfLines={1} style={styles.title}>{greeting.title}</Text><Text numberOfLines={1} style={styles.subtitle}>{greeting.subtitle}</Text></>}
    </View></SectionEntrance>
    {error && <Text style={styles.error}>{error}</Text>}
    <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
      {!habits.length && <SectionEntrance section="/habitos" order={1}><View style={styles.empty}><MaterialIcons name="calendar-today" size={44} color={color('#188038')} /><Text style={styles.emptyTitle}>{ready ? 'Empezá con un hábito.' : 'Cargando hábitos…'}</Text><Text style={styles.subtitle}>Cada punto cuenta una pequeña victoria.</Text></View></SectionEntrance>}
      {habits.map((habit, habitIndex) => {
        const checked = habit.completedDays.includes(today);
        const accent = habit.color;
        const goalLabel = habitGoalProgressLabel(habit, today);
        return <SectionEntrance key={habit.id} section="/habitos" order={habitIndex + 1}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Ver historial de ${habit.name}`} onPress={() => setSelected(habit.id)} style={styles.card}>
            <LinearGradient colors={habitCardColors(accent)} locations={[0, 0.52, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.cardGradient}>
              <View style={styles.cardTop}>
                <View style={[styles.iconBadge, { backgroundColor: `${accent}28` }]}>
                  <HabitSymbolView symbol={habit.symbol} color={accent} size={22} />
                </View>
                <View style={styles.nameBlock}>
                  <Text style={[styles.name, { color: accent }]} numberOfLines={1}>
                    {habit.name}{goalLabel ? <Text style={styles.goalInline}> {goalLabel}</Text> : null}
                  </Text>
                  {habit.description ? <Text style={styles.description} numberOfLines={1}>{habit.description}</Text> : null}
                </View>
                {habit.streakEnabled ? <HabitStreak habit={habit} today={today} /> : null}
                <HabitCompleteButton
                  checked={checked}
                  accent={accent}
                  mark="add"
                  label={`Completar hoy: ${habit.name}`}
                  onToggle={() => toggleDay(habit.id, today)}
                />
              </View>
              <HabitHistory habit={habit} today={today} onDarkSurface />
            </LinearGradient>
          </Pressable>
        </SectionEntrance>;
      })}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Nuevo hábito" disabled={!ready} onPress={() => setCreating(true)} style={[styles.newButton, { bottom: 11 }, !ready && { opacity: 0.5 }]}><MaterialIcons name="add" size={25} color="#fff" /><Text style={styles.newText}>Nuevo hábito</Text></Pressable>
    {creating && <HabitModal today={today} onClose={() => setCreating(false)} onSave={addHabit} />}
    {current && <HabitModal key={current.id} habit={current} onDelete={() => deleteHabit(current.id)} today={today} onClose={() => setSelected(null)} onSave={(draft) => updateHabit(current.id, draft)} onToggle={(day) => toggleDay(current.id, day)} />}
  </View></SafeAreaView>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color('#f8fafd') }, page: { flex: 1, width: '100%', maxWidth: 660, alignSelf: 'center' }, scroll: { flex: 1 },
  heading: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 22 },
  headingCompact: { paddingBottom: 12 },
  date: { color: color('#80868b'), fontFamily: 'Manrope-Regular', fontSize: 12, marginBottom: 8 },
  dateLarge: { fontFamily: 'Manrope-SemiBold', fontSize: 28, lineHeight: 36, color: color('#202124'), marginBottom: 0, letterSpacing: -1 },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 30, lineHeight: 38, color: color('#202124'), fontWeight: 'normal', letterSpacing: -1.2 }, subtitle: { fontFamily: 'Manrope-Regular', fontSize: 13, color: color('#80868b'), marginTop: 5, lineHeight: 19 },
  list: { paddingHorizontal: 20, paddingBottom: 150, gap: 16 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: '#3A3A40', overflow: 'hidden' },
  cardGradient: { padding: 20 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  iconBadge: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nameBlock: { flex: 1 }, name: { fontFamily: 'Manrope-SemiBold', fontSize: 19, fontWeight: 'normal', color: color('#253c2d') },
  goalInline: { fontFamily: 'Manrope-Medium', fontSize: 14, fontWeight: 'normal', color: '#A8A8AE' },
  description: { fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 18, color: '#8E8E94', marginTop: 3 },
  empty: { alignItems: 'center', paddingTop: 65, paddingHorizontal: 15 }, emptyTitle: { fontFamily: 'Manrope-Regular', fontSize: 19, color: color('#5f6368'), marginTop: 22 },
  newButton: { position: 'absolute', bottom: 22, right: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: color('#188038'), borderRadius: 20, paddingHorizontal: 20, paddingVertical: 18, elevation: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }, newText: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 15, fontWeight: 'normal' }, error: { color: color('#b3261e'), paddingHorizontal: 24, paddingBottom: 12 },
});
