import Pressable from '@/components/feedback-pressable';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colorChoices, useAppearance } from '@/theme/appearance';

export default function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const { preferences, update, ready, error, surface, text, muted, border } = useAppearance();
  const insets = useSafeAreaInsets();
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Opciones de apariencia" onPress={() => setOpen(true)} style={styles.trigger}><MaterialIcons name="settings" size={25} color={muted} /></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar opciones" onPress={() => setOpen(false)} />
        <View style={[styles.panel, { backgroundColor: surface, marginTop: insets.top + 60, borderColor: border }]}>
          <View style={styles.header}><Text style={[styles.title, { color: text }]}>Apariencia</Text><Pressable accessibilityRole="button" accessibilityLabel="Listo, cerrar opciones" onPress={() => setOpen(false)} style={styles.close}><MaterialIcons name="close" size={22} color={muted} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.label, { color: muted }]}>Tema</Text>
            <View style={styles.themes}>{[false, true].map((dark) => <Pressable key={String(dark)} disabled={!ready} accessibilityRole="radio" aria-checked={preferences.dark === dark} accessibilityState={{ checked: preferences.dark === dark }} accessibilityLabel={`Tema ${dark ? 'oscuro' : 'claro'}`} onPress={() => update({ dark })} style={[styles.theme, { borderColor: preferences.dark === dark ? preferences.tasks : border }]}><MaterialIcons name={dark ? 'dark-mode' : 'light-mode'} size={20} color={text} /><Text style={{ color: text }}>{dark ? 'Oscuro' : 'Claro'}</Text></Pressable>)}</View>
            {(['tasks', 'habits'] as const).map((section) => <View key={section} style={styles.group}><Text style={[styles.label, { color: muted }]}>Color de {section === 'tasks' ? 'Tareas' : 'Hábitos'}</Text><View style={styles.swatches}>{colorChoices.map(({ name, value }) => <Pressable key={value} disabled={!ready} accessibilityRole="radio" accessibilityLabel={`${section === 'tasks' ? 'Tareas' : 'Hábitos'}: ${name}`} aria-checked={preferences[section] === value} accessibilityState={{ checked: preferences[section] === value }} onPress={() => update({ [section]: value })} style={[styles.swatch, { backgroundColor: value }]}>{preferences[section] === value && <MaterialIcons name="check" size={22} color="#fff" />}</Pressable>)}</View></View>)}
            {error && <Text style={{ color: '#d65c66' }}>{error}</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { marginLeft: 'auto', width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: '#00000055', alignItems: 'center', paddingHorizontal: 20 }, panel: { width: '100%', maxWidth: 400, maxHeight: '80%', borderRadius: 24, borderWidth: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 20, fontWeight: '600' }, close: { padding: 8 }, content: { gap: 16, paddingTop: 18, paddingBottom: 8 },
  label: { fontSize: 13, fontWeight: '500' }, themes: { flexDirection: 'row', gap: 10 }, theme: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderWidth: 2, borderRadius: 14 }, group: { gap: 12, marginTop: 8 }, swatches: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
