import { useSectionStyles } from '@/theme/appearance';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { localDay, monthDays, yearWeeks, type Habit } from '@/models/habit';

function Dot({ day, completed, today, small = false }: { day: string | null; completed: Set<string>; today: string; small?: boolean }) {
  const { styles } = useSectionStyles(makeStyles, 'habits');
  return <View accessible={!!day} accessibilityLabel={day ? `${day}: ${completed.has(day) ? 'completado' : 'sin completar'}` : undefined} style={[styles.dot, small && styles.small, !day && styles.hidden, day && day > today ? styles.future : undefined, day && completed.has(day) ? styles.done : undefined]} />;
}
export default function HabitHistory({ habit, today, expanded = false }: { habit: Habit; today: string; expanded?: boolean }) {
  const { styles } = useSectionStyles(makeStyles, 'habits');
  const date = localDay(today);
  const completed = new Set(habit.completedDays);
  if (expanded) return <View style={styles.years}>{[date.getFullYear(), date.getFullYear() - 1, date.getFullYear() - 2].map((year) => <View key={year}><Text style={styles.year}>{year}</Text><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.weeks}>{yearWeeks(year).map((week, i) => <View key={i} style={styles.week}>{week.map((day, j) => <Dot key={day ?? j} day={day} completed={completed} today={today} small />)}</View>)}</ScrollView></View>)}<Text style={styles.legend}>Color: completado · Vacío: sin completar</Text></View>;
  return <View><Text style={styles.month}>{date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</Text><View style={styles.grid}>{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, i) => <View key={i} style={styles.cell}><Text style={styles.weekday}>{label}</Text></View>)}{monthDays(date.getFullYear(), date.getMonth()).map((day, i) => <View key={day ?? i} style={styles.cell}><Dot day={day} completed={completed} today={today} /></View>)}</View></View>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  dot: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: color('#c8d9cd'), backgroundColor: color('#fff') },
  small: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  done: { backgroundColor: color('#34a853'), borderColor: color('#34a853') }, future: { opacity: 0.35 }, hidden: { opacity: 0 },
  month: { fontSize: 12, color: color('#69766d'), marginBottom: 10, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '14.285714%', alignItems: 'center', paddingVertical: 5 },
  weekday: { fontSize: 11, color: color('#89958d') }, years: { gap: 22 }, year: { fontSize: 16, fontWeight: '600', color: color('#34483a'), marginBottom: 10 },
  weeks: { gap: 4, paddingBottom: 10 }, week: { gap: 4 }, legend: { fontSize: 12, color: color('#748078') },
});
