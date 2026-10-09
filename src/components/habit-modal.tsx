import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HabitStreak from '@/components/habit-streak';
import HabitHistory from '@/components/habit-history';
import { localDay, previousDay, type Habit } from '@/models/habit';

type Props = { habit?: Habit; today: string; onClose: () => void; onSave: (name: string, interval: Habit['intervalDays']) => void; onToggle?: (day: string) => void };
export default function HabitModal({ habit, today, onClose, onSave, onToggle }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'habits');
  const [name, setName] = useState(habit?.name ?? '');
  const [intervalText, setIntervalText] = useState(String(habit?.intervalDays ?? 1));
  const parsedInterval = Number(intervalText);
  const interval = Number.isSafeInteger(parsedInterval) && parsedInterval >= 1 ? parsedInterval : 1;
  const input = useRef<TextInput>(null);
  const focusName = useCallback(() => { if (!habit) input.current?.focus(); }, [habit]);
  const insets = useSafeAreaInsets();
  function finish() { if (name.trim()) onSave(name, interval); onClose(); }
  return <Modal transparent animationType="fade" visible onRequestClose={finish} onShow={focusName}>
    <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
      <Pressable feedback={false} accessibilityLabel="Guardar y cerrar hábito" style={StyleSheet.absoluteFill} onPress={finish} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.top}><Text style={styles.heading}>{habit ? 'Tu historial' : 'Nuevo hábito'}</Text><Pressable accessibilityRole="button" onPress={finish} style={styles.finish}><Text style={styles.finishText}>{habit ? 'Listo' : 'Crear'}</Text></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <TextInput ref={input} accessibilityLabel="Nombre del hábito" placeholder="Nombre del hábito" placeholderTextColor={color('#9aa0a6')} value={name} onChangeText={setName} style={styles.input} maxLength={120} />
          {habit ? <>
            <Text style={styles.hint}>{habit.intervalDays === 1 ? 'Cada día' : `Cada ${habit.intervalDays} días`}</Text>
            <HabitStreak habit={habit} today={today} />
            <View style={styles.actions}>{[{ label: 'Hoy', day: today }, { label: 'Ayer', day: previousDay(localDay(today)) }].map(({ label, day }) => {
              const checked = habit.completedDays.includes(day);
              return <Pressable key={day} accessibilityRole="checkbox" accessibilityLabel={`Completar ${label.toLowerCase()}`} aria-checked={checked} accessibilityState={{ checked }} onPress={() => onToggle?.(day)} style={[styles.dayButton, checked && styles.checkedButton]}><MaterialIcons name={checked ? 'check-circle' : label === 'Hoy' ? 'add' : 'radio-button-unchecked'} size={23} color={color('#188038')} /><Text style={styles.dayLabel}>{label}</Text></Pressable>;
            })}</View>
            <HabitHistory habit={habit} today={today} expanded />
          </> : <><Text style={styles.label}>¿Cada cuántos días querés completarlo?</Text><View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="Reducir días" disabled={interval <= 1} onPress={() => setIntervalText(String(interval - 1))} style={[styles.stepButton, interval <= 1 && styles.disabled]}><MaterialIcons name="remove" size={24} color={color('#188038')} /></Pressable>
              <TextInput accessibilityLabel="Frecuencia en días" inputMode="numeric" keyboardType="number-pad" value={intervalText} onChangeText={(value) => { if (/^\d*$/.test(value)) setIntervalText(value); }} onBlur={() => setIntervalText(String(interval))} selectTextOnFocus style={styles.numberInput} />
              <Pressable accessibilityRole="button" accessibilityLabel="Aumentar días" disabled={interval >= Number.MAX_SAFE_INTEGER} onPress={() => setIntervalText(String(interval + 1))} style={styles.stepButton}><MaterialIcons name="add" size={24} color={color('#188038')} /></Pressable>
              <Text style={styles.hint}>{interval === 1 ? 'día' : 'días'}</Text>
            </View><Text style={styles.hint}>Marcá los días que lo cumplas. Tu progreso se guarda automáticamente.</Text></>}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,33,36,0.3)' },
  sheet: { backgroundColor: color('#fff'), borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 660, alignSelf: 'center', maxHeight: '92%' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 18 }, heading: { fontSize: 16, color: color('#5f6368'), fontWeight: '500' },
  finish: { padding: 12 }, finishText: { fontSize: 16, color: color('#188038'), fontWeight: '600' }, content: { padding: 24, paddingTop: 12, gap: 20 },
  input: { fontSize: 24, color: color('#202124'), paddingVertical: 10 }, label: { fontSize: 15, color: color('#46534a') }, hint: { fontSize: 13, lineHeight: 20, color: color('#808b83') },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 }, stepButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: color('#e6f4ea'), alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.35 }, numberInput: { width: 70, paddingVertical: 10, borderRadius: 12, backgroundColor: color('#f3f6f4'), textAlign: 'center', fontSize: 22, color: color('#253c2d') },
  actions: { flexDirection: 'row', gap: 12 }, dayButton: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: color('#f3f6f4'), flex: 1 }, checkedButton: { backgroundColor: color('#e6f4ea') }, dayLabel: { color: color('#188038'), fontSize: 15, fontWeight: '500' },
});
