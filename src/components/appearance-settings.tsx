import Pressable from '@/components/feedback-pressable';
import { colorChoices, useAppearance } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export default function AppearanceSettings() {
  const { preferences, themeMode, setThemeMode, update, ready, error, text, muted, border } = useAppearance();
  return <View style={styles.content}>
    <Text accessibilityRole="header" style={[styles.personalization, { color: text }]}>Personalización</Text>
    <Text style={[styles.label, { color: muted }]}>Tema</Text>
    <View style={styles.themes}>{([['system', 'Sistema', 'brightness-auto'], ['light', 'Claro', 'light-mode'], ['dark', 'Oscuro', 'dark-mode']] as const).map(([mode, label, icon]) => <Pressable key={mode} disabled={!ready} accessibilityRole="radio" aria-checked={themeMode === mode} accessibilityState={{ checked: themeMode === mode }} accessibilityLabel={`Tema ${label.toLowerCase()}`} onPress={() => setThemeMode(mode)} style={[styles.theme, { borderColor: themeMode === mode ? preferences.tasks : border }]}><MaterialIcons name={icon} size={20} color={text} /><Text style={{ color: text }}>{label}</Text></Pressable>)}</View>
    {(['tasks', 'habits', 'agenda'] as const).map((section) => <View key={section} style={styles.group}><Text style={[styles.label, { color: muted }]}>Color de {section === 'tasks' ? 'Tareas' : section === 'habits' ? 'Hábitos' : 'Agenda'}</Text><View style={styles.swatches}>{colorChoices.map(({ name, value }) => <Pressable key={value} disabled={!ready} accessibilityRole="radio" accessibilityLabel={`${section === 'tasks' ? 'Tareas' : section === 'habits' ? 'Hábitos' : 'Agenda'}: ${name}`} aria-checked={preferences[section] === value} accessibilityState={{ checked: preferences[section] === value }} onPress={() => update({ [section]: value })} style={[styles.swatch, { backgroundColor: value }]}>{preferences[section] === value && <MaterialIcons name="check" size={22} color="#fff" />}</Pressable>)}</View></View>)}
    {error && <Text style={styles.error}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 20 },
  personalization: { fontFamily: 'Manrope-SemiBold', fontSize: 18, marginTop: 4 },
  label: { fontFamily: 'Manrope-Medium', fontSize: 13, fontWeight: 'normal' },
  themes: { flexDirection: 'row', gap: 8 },
  theme: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 12, borderWidth: 2, borderRadius: 14 },
  group: { gap: 12, marginTop: 8 },
  swatches: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#d65c66' },
});
