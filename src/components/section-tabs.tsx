import Pressable from '@/components/feedback-pressable';
import AppearanceMenu from '@/components/appearance-menu';
import { useHabitAttention } from '@/hooks/habit-attention';
import { useAppearance } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, Text, View } from 'react-native';

function HabitFlame() {
  const [motion] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let active = true;
    let reduced = true;
    let animation: Animated.CompositeAnimation | undefined;
    const refresh = () => {
      animation?.stop();
      motion.setValue(0);
      if (!active || reduced || (AppState.currentState && AppState.currentState !== 'active')) return;
      animation = Animated.loop(Animated.sequence([
        Animated.timing(motion, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
        Animated.timing(motion, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      ]));
      animation.start();
    };
    const update = (enabled: boolean) => { if (active) { reduced = enabled; refresh(); } };
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    const accessibility = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    const appState = AppState.addEventListener('change', refresh);
    return () => { active = false; animation?.stop(); accessibility.remove(); appState.remove(); };
  }, [motion]);
  return <Animated.Text pointerEvents="none" accessible={false} style={[styles.flame, { transform: [
    { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
    { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] }) },
    { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
  ] }]}>🔥</Animated.Text>;
}

export default function SectionTabs({ active }: { active: 'tasks' | 'habits' | 'agenda' }) {
  const { agendaView, agendaDate } = useLocalSearchParams<{ agendaView?: string; agendaDate?: string }>();
  const { preferences } = useAppearance();
  const attention = useHabitAttention();
  const taskSoft = `${preferences.tasks}${preferences.dark ? '26' : '18'}`;
  const agendaColor = preferences.agenda;
  const agendaSoft = `${agendaColor}${preferences.dark ? '26' : '18'}`;
  const habitSoft = `${preferences.habits}${preferences.dark ? '26' : '18'}`;
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="tab" accessibilityLabel="Tareas" aria-selected={active === 'tasks'} accessibilityState={{ selected: active === 'tasks' }} onPress={() => router.navigate('/')} style={[styles.tab, active !== 'tasks' && styles.collapsed, active === 'tasks' && { backgroundColor: taskSoft }]}>
        <View style={[styles.taskIcon, { backgroundColor: taskSoft }]}><MaterialIcons name="done-all" size={22} color={preferences.tasks} /></View>
        {active === 'tasks' && <Text style={[styles.label, { color: preferences.tasks }]}>Tareas</Text>}
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Hábitos" aria-selected={active === 'habits'} accessibilityState={{ selected: active === 'habits' }} onPress={() => router.navigate('/habitos')} style={[styles.tab, active !== 'habits' && styles.collapsed, active === 'habits' && { backgroundColor: habitSoft }]}>
        <View style={[styles.habitIcon, { backgroundColor: habitSoft }]}><MaterialIcons name="calendar-today" size={19} color={preferences.habits} />{attention && <HabitFlame />}</View>
        {active === 'habits' && <Text style={[styles.label, { color: preferences.habits }]}>Hábitos</Text>}
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Agenda" aria-selected={active === 'agenda'} accessibilityState={{ selected: active === 'agenda' }} onPress={() => router.navigate(agendaView ? { pathname: '/agenda', params: { view: agendaView, date: agendaDate } } : '/agenda')} style={[styles.tab, active !== 'agenda' && styles.collapsed, active === 'agenda' && { backgroundColor: agendaSoft }]}>
        <View style={[styles.taskIcon, { backgroundColor: agendaSoft }]}><MaterialIcons name="event-note" size={22} color={agendaColor} /></View>
        {active === 'agenda' && <Text style={[styles.label, { color: agendaColor }]}>Agenda</Text>}
      </Pressable>
      <AppearanceMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 5, paddingRight: 8, borderRadius: 15 },
  collapsed: { paddingRight: 5, gap: 0 },
  taskIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  habitIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flame: { position: 'absolute', top: -5, right: -3, fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 17, includeFontPadding: false },
  label: { fontFamily: 'Manrope-SemiBold', fontSize: 16, fontWeight: 'normal', letterSpacing: -0.3 },
});
