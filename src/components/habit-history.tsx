import { useSectionStyles } from '@/theme/appearance';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { habitHistoryYears, habitProgressRange, localDay, monthDays, yearWeeks, type Habit } from '@/models/habit';

function Dot({ day, completed, today, small = false }: { day: string | null; completed: Set<string>; today: string; small?: boolean }) {
  const { styles } = useSectionStyles(makeStyles, 'habits');
  return <View accessible={!!day} accessibilityLabel={day ? `${day}: ${completed.has(day) ? 'completado' : 'sin completar'}` : undefined} style={[styles.dot, small && styles.small, !day && styles.hidden, day && day > today ? styles.future : undefined, day && completed.has(day) ? styles.done : undefined]} />;
}
export default function HabitHistory({ habit, today, expanded = false, completedRange = false }: { habit: Habit; today: string; expanded?: boolean; completedRange?: boolean }) {
  const { styles } = useSectionStyles(makeStyles, 'habits');
  const date = localDay(today);
  const completed = new Set(habit.completedDays);
  const range = completedRange ? habitProgressRange(habit, today) : null;
  if (expanded && completedRange) {
    if (!range) return null;
    const months: Date[] = [];
    const cursor = localDay(range.first);
    cursor.setDate(1);
    while (cursor.getFullYear() * 12 + cursor.getMonth() <= Number(range.last.slice(0, 4)) * 12 + Number(range.last.slice(5, 7)) - 1) {
      months.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return <View style={styles.years}>
      <Text style={styles.summary}>{localDay(range.first).toLocaleDateString('es')} — {localDay(range.last).toLocaleDateString('es')}</Text>
      {months.map((month) => {
        const cells = monthDays(month.getFullYear(), month.getMonth()).map((day) => day && (day < range.first || day > range.last) ? null : day);
        while (cells.length >= 7 && cells.slice(0, 7).every((day) => !day)) cells.splice(0, 7);
        while (cells.length && !cells.at(-1)) cells.pop();
        return <View key={`${month.getFullYear()}-${month.getMonth()}`}>
          <Text style={styles.month}>{month.toLocaleDateString('es', { month: 'long', year: 'numeric' })}</Text>
          <View style={styles.grid}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, i) => <View key={`label-${i}`} style={styles.cell}><Text style={styles.weekday}>{label}</Text></View>)}
            {cells.map((day, i) => <View key={day ?? i} style={styles.cell}><Dot day={day} completed={completed} today={today} /></View>)}
          </View>
        </View>;
      })}
      <Text style={styles.legend}>Color: completado · Vacío: sin completar</Text>
    </View>;
  }
  if (expanded) return <View style={styles.years}>{habitHistoryYears(habit, today).map((year) => {
    const weeks = yearWeeks(year);
    const months = Array.from({ length: 12 }, (_, month) => ({ month, week: weeks.findIndex((days) => days.some((day) => day?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}-`))) })).filter(({ week }) => week >= 0);
    const width = Math.max(weeks.length * 16 - 4, (months.at(-1)?.week ?? 0) * 16 + 32);
    const count = [...completed].filter((day) => day.startsWith(`${year}-`) && day <= today).length;
    return <View key={year} style={styles.yearSection}>
      <View style={styles.yearHeader}><Text style={styles.year}>{year}</Text><Text style={styles.summary}>{count} {count === 1 ? 'día completado' : 'días completados'}</Text></View>
      <View style={styles.yearGrid}>
        <View style={styles.dayLabels}>{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, i) => <Text key={i} style={styles.dayLabel}>{label}</Text>)}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.yearScroll}><View>
          <View style={[styles.monthLabels, { width }]}>{months.map(({ month, week }) => <Text key={month} style={[styles.monthLabel, { left: week * 16 }]}>{new Date(year, month, 1).toLocaleDateString('es', { month: 'short' }).replace('.', '')}</Text>)}</View>
          <View style={styles.weeks}>{weeks.map((week, i) => <View key={i} style={styles.week}>{week.map((day, j) => <Dot key={day ?? j} day={day} completed={completed} today={today} small />)}</View>)}</View>
        </View></ScrollView>
      </View>
    </View>;
  })}<Text style={styles.legend}>Color: completado · Vacío: sin completar</Text></View>;
  return <View><Text style={styles.month}>{date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</Text><View style={styles.grid}>{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, i) => <View key={i} style={styles.cell}><Text style={styles.weekday}>{label}</Text></View>)}{monthDays(date.getFullYear(), date.getMonth()).map((day, i) => <View key={day ?? i} style={styles.cell}><Dot day={day} completed={completed} today={today} /></View>)}</View></View>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  dot: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: color('#c8d9cd'), backgroundColor: color('#fff') },
  small: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  done: { backgroundColor: color('#34a853'), borderColor: color('#34a853') }, future: { opacity: 0.35 }, hidden: { opacity: 0 },
  month: { fontFamily: 'Manrope-Regular', fontSize: 12, color: color('#69766d'), marginBottom: 10, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '14.285714%', alignItems: 'center', paddingVertical: 5 },
  weekday: { fontFamily: 'Manrope-Regular', fontSize: 11, color: color('#89958d') }, years: { gap: 20 }, year: { fontFamily: 'Manrope-SemiBold', fontSize: 16, fontWeight: 'normal', color: color('#34483a') },
  yearSection: { gap: 12 }, yearHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, summary: { fontFamily: 'Manrope-Regular', fontSize: 12, color: color('#748078') },
  yearScroll: { flex: 1, minWidth: 0 },
  yearGrid: { flexDirection: 'row', gap: 8 }, dayLabels: { paddingTop: 22, gap: 4 }, dayLabel: { fontFamily: 'Manrope-Regular', fontSize: 9, lineHeight: 12, height: 12, color: color('#89958d') },
  monthLabels: { height: 22 }, monthLabel: { position: 'absolute', fontFamily: 'Manrope-Regular', fontSize: 10, color: color('#69766d'), textTransform: 'capitalize' },
  weeks: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingBottom: 10 }, week: { gap: 4 }, legend: { fontFamily: 'Manrope-Regular', fontSize: 12, color: color('#748078') },
});
