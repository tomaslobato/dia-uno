import Pressable from '@/components/feedback-pressable';
import { accentTextColor, useAppearance } from '@/theme/appearance';
import SettingsTab from '@/components/settings-tab';
import NavTabFace, { NavTabIcon } from '@/components/nav-tab-face';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Section = 'tasks' | 'habits' | 'agenda' | 'settings';

export default function SectionTabs() {
  const pathname = usePathname();
  const { agendaView, agendaDate, day } = useLocalSearchParams<{ agendaView?: string; agendaDate?: string; day?: string }>();
  const active: Section = pathname === '/habitos' ? 'habits' : pathname === '/agenda' || Boolean(day) ? 'agenda' : pathname === '/ajustes' ? 'settings' : 'tasks';
  const { preferences } = useAppearance();
  const { width } = useWindowDimensions();
  const desktop = width >= 768;
  const insets = useSafeAreaInsets();
  const taskTextColor = accentTextColor(preferences.tasks, preferences.dark);
  const habitTextColor = accentTextColor(preferences.habits, preferences.dark);
  const agendaTextColor = accentTextColor(preferences.agenda, preferences.dark);
  const inactive = preferences.dark ? '#a6adb8' : '#80868b';
  function navigate(to: Section) {
    if (to === 'tasks' && day) router.setParams({ day: undefined, agendaView: undefined, agendaDate: undefined });
    else if (to === 'tasks') router.navigate('/');
    else if (to === 'habits') router.navigate('/habitos');
    else if (to === 'agenda') router.navigate({ pathname: '/agenda', params: { ...(agendaView ? { view: agendaView } : {}), ...(agendaDate ? { date: agendaDate } : {}) } });
    else if (to === 'settings') router.navigate('/ajustes');
  }
  return (
    <View style={[styles.bar, { backgroundColor: preferences.dark ? '#22252b' : '#fff', borderColor: preferences.dark ? '#3a4049' : '#e7ebf0', paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Pressable accessibilityRole="tab" accessibilityLabel="Tareas" aria-selected={active === 'tasks'} accessibilityState={{ selected: active === 'tasks' }} onPress={() => navigate('tasks')} style={desktop ? styles.desktopTab : styles.tab}>
        <NavTabFace active={active === 'tasks'} accent={preferences.tasks} dark={preferences.dark}>
          <NavTabIcon active={active === 'tasks'}><MaterialIcons name="checklist" size={25} color={active === 'tasks' ? taskTextColor : inactive} /></NavTabIcon>
          <Text style={[styles.label, { color: active === 'tasks' ? taskTextColor : inactive }]}>Tareas</Text>
        </NavTabFace>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Hábitos" aria-selected={active === 'habits'} accessibilityState={{ selected: active === 'habits' }} onPress={() => navigate('habits')} style={desktop ? styles.desktopTab : styles.tab}>
        <NavTabFace active={active === 'habits'} accent={preferences.habits} dark={preferences.dark}>
          <NavTabIcon active={active === 'habits'}><View style={styles.iconWrap}>{active === 'habits' ? <MaterialIcons name="local-fire-department" size={25} color={habitTextColor} /> : <Ionicons name="flame" size={24} color={inactive} />}</View></NavTabIcon>
          <Text style={[styles.label, { color: active === 'habits' ? habitTextColor : inactive }]}>Hábitos</Text>
        </NavTabFace>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Agenda" aria-selected={active === 'agenda'} accessibilityState={{ selected: active === 'agenda' }} onPress={() => navigate('agenda')} style={desktop ? styles.desktopTab : styles.tab}>
        <NavTabFace active={active === 'agenda'} accent={preferences.agenda} dark={preferences.dark}>
          <NavTabIcon active={active === 'agenda'}><MaterialIcons name="event-note" size={24} color={active === 'agenda' ? agendaTextColor : inactive} /></NavTabIcon>
          <Text style={[styles.label, { color: active === 'agenda' ? agendaTextColor : inactive }]}>Agenda</Text>
        </NavTabFace>
      </Pressable>
      <SettingsTab active={active === 'settings'} desktop={desktop} inactiveColor={inactive} onPress={() => navigate('settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 62, paddingTop: 7, paddingHorizontal: 0, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { width: '25%', flexGrow: 0, flexShrink: 0, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, overflow: 'visible' },
  desktopTab: { width: 120, flexGrow: 0, flexShrink: 0, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, overflow: 'visible' },
  iconWrap: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Manrope-Medium', fontSize: 10, lineHeight: 13, fontWeight: 'normal' },
});
