import Pressable from '@/components/feedback-pressable';
import { useHabitAttention } from '@/hooks/habit-attention';
import { accentTextColor, useAppearance } from '@/theme/appearance';
import SettingsTab from '@/components/settings-tab';
import NavTabFace, { NavTabIcon } from '@/components/nav-tab-face';
import { useSectionMotion } from '@/components/section-motion';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

type Section = 'tasks' | 'habits' | 'agenda' | 'settings';

function slideDirection(from: Section, to: Section): 'left' | 'right' | null {
  if (from === to) return null;
  if (from === 'tasks') return 'right';
  if (from === 'settings') return 'left';
  if (from === 'habits') return to === 'tasks' ? 'left' : 'right';
  return to === 'settings' ? 'right' : 'left';
}

export default function SectionTabs({ active }: { active: Section }) {
  const { agendaView, agendaDate, day } = useLocalSearchParams<{ agendaView?: string; agendaDate?: string; day?: string }>();
  const { preferences } = useAppearance();
  const requestSectionMotion = useSectionMotion();
  const insets = useSafeAreaInsets();
  const attention = useHabitAttention();
  const taskTextColor = accentTextColor(preferences.tasks, preferences.dark);
  const habitTextColor = accentTextColor(preferences.habits, preferences.dark);
  const agendaTextColor = accentTextColor(preferences.agenda, preferences.dark);
  const inactive = preferences.dark ? '#a6adb8' : '#80868b';
  function navigate(to: Section) {
    const direction = slideDirection(active, to);
    const pathname = to === 'tasks' ? '/' : to === 'habits' ? '/habitos' : to === 'agenda' ? '/agenda' : '/ajustes';
    const clearAgendaDay = to === 'tasks' && Boolean(day);
    if (direction) requestSectionMotion(pathname, direction, clearAgendaDay);
    if (to === 'tasks' && day) router.setParams({ day: undefined, agendaView: undefined, agendaDate: undefined });
    else if (to === 'tasks') router.navigate('/');
    else if (to === 'habits') router.navigate('/habitos');
    else if (to === 'agenda') router.navigate({ pathname: '/agenda', params: { ...(agendaView ? { view: agendaView } : {}), ...(agendaDate ? { date: agendaDate } : {}) } });
    else if (to === 'settings') router.navigate('/ajustes');
  }
  return (
    <View style={[styles.bar, { backgroundColor: preferences.dark ? '#22252b' : '#fff', borderColor: preferences.dark ? '#3a4049' : '#e7ebf0', paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Pressable accessibilityRole="tab" accessibilityLabel="Tareas" aria-selected={active === 'tasks'} accessibilityState={{ selected: active === 'tasks' }} onPress={() => navigate('tasks')} style={styles.tab}>
        <NavTabFace active={active === 'tasks'} accent={preferences.tasks} dark={preferences.dark}>
          <NavTabIcon active={active === 'tasks'}><MaterialIcons name="checklist" size={25} color={active === 'tasks' ? taskTextColor : inactive} /></NavTabIcon>
          <Text style={[styles.label, { color: active === 'tasks' ? taskTextColor : inactive }]}>Tareas</Text>
        </NavTabFace>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Hábitos" aria-selected={active === 'habits'} accessibilityState={{ selected: active === 'habits' }} onPress={() => navigate('habits')} style={styles.tab}>
        <NavTabFace active={active === 'habits'} accent={preferences.habits} dark={preferences.dark}>
          <NavTabIcon active={active === 'habits'}><View style={styles.iconWrap}><MaterialIcons name="calendar-today" size={22} color={active === 'habits' ? habitTextColor : inactive} />{attention && <HabitFlame />}</View></NavTabIcon>
          <Text style={[styles.label, { color: active === 'habits' ? habitTextColor : inactive }]}>Hábitos</Text>
        </NavTabFace>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Agenda" aria-selected={active === 'agenda'} accessibilityState={{ selected: active === 'agenda' }} onPress={() => navigate('agenda')} style={styles.tab}>
        <NavTabFace active={active === 'agenda'} accent={preferences.agenda} dark={preferences.dark}>
          <NavTabIcon active={active === 'agenda'}><MaterialIcons name="event-note" size={24} color={active === 'agenda' ? agendaTextColor : inactive} /></NavTabIcon>
          <Text style={[styles.label, { color: active === 'agenda' ? agendaTextColor : inactive }]}>Agenda</Text>
        </NavTabFace>
      </Pressable>
      <SettingsTab active={active === 'settings'} inactiveColor={inactive} onPress={() => navigate('settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', minHeight: 62, paddingTop: 7, paddingHorizontal: 0, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { width: '25%', flexGrow: 0, flexShrink: 0, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, overflow: 'visible' },
  iconWrap: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  flame: { position: 'absolute', top: -5, right: -3, fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 17, includeFontPadding: false },
  label: { fontFamily: 'Manrope-Medium', fontSize: 10, lineHeight: 13, fontWeight: 'normal' },
});
