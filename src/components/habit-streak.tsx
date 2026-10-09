import { useAppearance } from '@/theme/appearance';
import { StyleSheet, Text, View } from 'react-native';
import { habitStreak, type Habit } from '@/models/habit';

export default function HabitStreak({ habit, today }: { habit: Habit; today: string }) {
  const { preferences } = useAppearance();
  const count = habitStreak(habit, today);
  return <View accessible accessibilityLabel={`Racha: ${count} ${count === 1 ? 'vez' : 'veces'}`} style={[styles.badge, count === 0 && styles.cold, preferences.dark && { backgroundColor: count ? '#49301e' : '#263644' }]}><Text style={styles.emoji}>{count > 0 ? '🔥' : '🧊'}</Text><Text style={[styles.count, count === 0 && styles.coldText, preferences.dark && { color: count ? '#ffc28d' : '#b3d4ed' }]}>{count}</Text></View>;
}
const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', height: 38, justifyContent: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 14, backgroundColor: '#fff3e6' },
  cold: { backgroundColor: '#edf4fa' }, emoji: { fontSize: 18, lineHeight: 23, includeFontPadding: false }, count: { fontSize: 15, lineHeight: 21, includeFontPadding: false, fontWeight: '600', color: '#b65b16' }, coldText: { color: '#6e8ba4' },
});
