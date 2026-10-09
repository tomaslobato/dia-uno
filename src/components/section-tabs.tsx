import Pressable from '@/components/feedback-pressable';
import AppearanceMenu from '@/components/appearance-menu';
import { useAppearance } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SectionTabs({ active }: { active: 'tasks' | 'habits' }) {
  const { preferences } = useAppearance();
  const taskSoft = `${preferences.tasks}${preferences.dark ? '26' : '18'}`;
  const habitSoft = `${preferences.habits}${preferences.dark ? '26' : '18'}`;
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="tab" accessibilityLabel="Tareas" accessibilityState={{ selected: active === 'tasks' }} onPress={() => router.navigate('/')} style={[styles.tab, active === 'tasks' && { backgroundColor: taskSoft }]}>
        <View style={[styles.taskIcon, { backgroundColor: taskSoft }]}><MaterialIcons name="done-all" size={22} color={preferences.tasks} /></View>
        <Text style={[styles.label, { color: preferences.tasks }]}>Tareas</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Hábitos" accessibilityState={{ selected: active === 'habits' }} onPress={() => router.navigate('/habitos')} style={[styles.tab, active === 'habits' && { backgroundColor: habitSoft }]}>
        <View style={[styles.habitIcon, { backgroundColor: habitSoft }]}><MaterialIcons name="calendar-today" size={19} color={preferences.habits} /></View>
        <Text style={[styles.label, { color: preferences.habits }]}>Hábitos</Text>
      </Pressable>
      <AppearanceMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18, gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 5, paddingRight: 8, borderRadius: 15 },
  taskIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  habitIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
});
