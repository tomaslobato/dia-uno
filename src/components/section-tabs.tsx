import { accentTextColor, useAppearance, type NavSection } from '@/theme/appearance';
import SettingsTab from '@/components/settings-tab';
import { NavTabButton, NavTabIcon } from '@/components/nav-tab-face';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Section = NavSection | 'settings';

export default function SectionTabs() {
  const pathname = usePathname();
  const { agendaView, agendaDate, day } = useLocalSearchParams<{ agendaView?: string; agendaDate?: string; day?: string }>();
  const active: Section = pathname === '/habitos' ? 'habits' : pathname === '/agenda' || Boolean(day) ? 'agenda' : pathname === '/ajustes' ? 'settings' : 'tasks';
  const { preferences } = useAppearance();
  const { width } = useWindowDimensions();
  const desktop = width >= 768;
  const insets = useSafeAreaInsets();
  const darkBar = preferences.dark;
  const inactive = darkBar ? '#a6adb8' : '#80868b';
  function navigate(to: Section) {
    if (to === 'tasks' && day) router.setParams({ day: undefined, agendaView: undefined, agendaDate: undefined });
    else if (to === 'tasks') router.navigate('/');
    else if (to === 'habits') router.navigate('/habitos');
    else if (to === 'agenda') router.navigate({ pathname: '/agenda', params: { ...(agendaView ? { view: agendaView } : {}), ...(agendaDate ? { date: agendaDate } : {}) } });
    else if (to === 'settings') router.navigate('/ajustes');
  }
  function renderSectionTab(section: NavSection) {
    const selected = active === section;
    const accent = preferences[section];
    const textColor = accentTextColor(accent, darkBar);
    const label = section === 'tasks' ? 'Tareas' : section === 'habits' ? 'Hábitos' : 'Agenda';
    const icon = section === 'tasks'
      ? <MaterialIcons name="checklist" size={25} color={selected ? textColor : inactive} />
      : section === 'habits'
        ? <View style={styles.iconWrap}>{selected ? <MaterialIcons name="local-fire-department" size={25} color={textColor} /> : <Ionicons name="flame" size={24} color={inactive} />}</View>
        : <MaterialIcons name="event-note" size={24} color={selected ? textColor : inactive} />;
    return (
      <NavTabButton
        key={section}
        active={selected}
        accent={accent}
        dark={darkBar}
        accessibilityLabel={label}
        onPress={() => navigate(section)}
        style={desktop ? styles.desktopTab : styles.tab}
      >
        <NavTabIcon active={selected}>{icon}</NavTabIcon>
        <Text style={[styles.label, { color: selected ? textColor : inactive }]}>{label}</Text>
      </NavTabButton>
    );
  }
  return (
    <View style={[styles.bar, { backgroundColor: darkBar ? '#000000' : '#ffffff', borderColor: darkBar ? '#2a2a2a' : '#e7ebf0', paddingBottom: Math.max(insets.bottom, 8) }]}>
      {preferences.navOrder.map(renderSectionTab)}
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
