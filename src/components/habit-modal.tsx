import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HabitStreak from '@/components/habit-streak';
import HabitHistory from '@/components/habit-history';
import { localDay, previousDay, type Habit } from '@/models/habit';

type Props = { habit?: Habit; today: string; onClose: () => void; onSave: (name: string, interval: Habit['intervalDays'], description: string) => void; onToggle?: (day: string) => void; onDelete?: () => void };
export default function HabitModal({ habit, today, onClose, onSave, onToggle, onDelete }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'habits');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleting = useRef(false);
  const [name, setName] = useState(habit?.name ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [intervalText, setIntervalText] = useState(String(habit?.intervalDays ?? 1));
  const parsedInterval = Number(intervalText);
  const interval = Number.isSafeInteger(parsedInterval) && parsedInterval >= 1 ? parsedInterval : 1;
  const input = useRef<TextInput>(null);
  const focusName = useCallback(() => { if (!habit) input.current?.focus(); }, [habit]);
  const insets = useSafeAreaInsets();
  function finish() { if (name.trim()) onSave(name, interval, description); onClose(); }
  return <Modal transparent animationType="fade" visible onRequestClose={() => confirmDelete ? setConfirmDelete(false) : finish()} onShow={focusName}>
    <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.overlay, confirmDelete && styles.confirmationOverlay]}>
      <Pressable feedback={false} accessibilityRole="button" accessibilityLabel={confirmDelete ? "Cerrar confirmación sin eliminar" : "Guardar y cerrar hábito"} style={StyleSheet.absoluteFill} onPress={() => confirmDelete ? setConfirmDelete(false) : finish()} />
      {confirmDelete ? <View style={styles.confirmation} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={styles.confirmationTitle}>¿Eliminar hábito?</Text>
        <Text style={styles.confirmationMessage}>Se eliminará “{habit?.name}” junto con todo su historial. Esta acción no se puede deshacer.</Text>
        <View style={styles.confirmationActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar eliminación del hábito" onPress={() => setConfirmDelete(false)} style={styles.confirmationButton}><Text style={styles.finishText}>Cancelar</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Confirmar eliminación del hábito" onPress={() => { if (deleting.current) return; deleting.current = true; onDelete?.(); onClose(); }} style={styles.confirmationButton}><Text style={styles.deleteText}>Eliminar</Text></Pressable>
        </View>
      </View> : <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.top}><Text style={styles.heading}>{habit ? 'Tu historial' : 'Nuevo hábito'}</Text><View style={styles.headerActions}>{habit && onDelete && <Pressable accessibilityRole="button" accessibilityLabel="Eliminar hábito" onPress={() => { Keyboard.dismiss(); setConfirmDelete(true); }} style={styles.finish}><MaterialIcons name="delete-outline" size={22} color={color('#b3261e')} /></Pressable>}<Pressable accessibilityRole="button" onPress={finish} style={styles.finish}><Text style={styles.finishText}>{habit ? 'Listo' : 'Crear'}</Text></Pressable></View></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <TextInput ref={input} accessibilityLabel="Nombre del hábito" placeholder="Nombre del hábito" placeholderTextColor={color('#9aa0a6')} value={name} onChangeText={setName} style={styles.input} maxLength={120} />
          <TextInput accessibilityLabel="Descripción del hábito" placeholder="Añadir una descripción" placeholderTextColor={color('#9aa0a6')} value={description} onChangeText={setDescription} style={styles.description} multiline maxLength={4000} textAlignVertical="top" />
          <Text style={styles.label}>¿Cada cuántos días quieres completarlo?</Text>
          <View style={styles.stepper}>
            <Pressable accessibilityRole="button" accessibilityLabel="Reducir días" disabled={interval <= 1} onPress={() => setIntervalText(String(interval - 1))} style={[styles.stepButton, interval <= 1 && styles.disabled]}><MaterialIcons name="remove" size={24} color={color('#188038')} /></Pressable>
            <TextInput accessibilityLabel="Frecuencia en días" inputMode="numeric" keyboardType="number-pad" value={intervalText} onChangeText={(value) => { if (/^\d*$/.test(value)) setIntervalText(value); }} onBlur={() => setIntervalText(String(interval))} selectTextOnFocus style={styles.numberInput} />
            <Pressable accessibilityRole="button" accessibilityLabel="Aumentar días" disabled={interval >= Number.MAX_SAFE_INTEGER} onPress={() => setIntervalText(String(interval + 1))} style={styles.stepButton}><MaterialIcons name="add" size={24} color={color('#188038')} /></Pressable>
            <Text style={styles.hint}>{interval === 1 ? 'día' : 'días'}</Text>
          </View>
          {habit ? <>
            <Text style={styles.hint}>{habit.intervalDays === 1 ? 'Cada día' : `Cada ${habit.intervalDays} días`}</Text>
            <HabitStreak habit={habit} today={today} />
            <View style={styles.actions}>{[{ label: 'Hoy', day: today }, { label: 'Ayer', day: previousDay(localDay(today)) }].map(({ label, day }) => {
              const checked = habit.completedDays.includes(day);
              return <Pressable key={day} accessibilityRole="checkbox" accessibilityLabel={`Completar ${label.toLowerCase()}`} aria-checked={checked} accessibilityState={{ checked }} onPress={() => onToggle?.(day)} style={[styles.dayButton, checked && styles.checkedButton]}><MaterialIcons name={checked ? 'check-circle' : label === 'Hoy' ? 'add' : 'radio-button-unchecked'} size={23} color={color('#188038')} /><Text style={styles.dayLabel}>{label}</Text></Pressable>;
            })}</View>
            <HabitHistory habit={habit} today={today} expanded />
          </> : <Text style={styles.hint}>Marca los días que lo cumplas. Tu progreso se guarda automáticamente.</Text>}
        </ScrollView>
      </View>}
    </KeyboardAvoidingView>
  </Modal>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,33,36,0.3)' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  confirmationOverlay: { justifyContent: 'center', paddingHorizontal: 24 },
  confirmation: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: color('#fff'), borderRadius: 24, padding: 24, gap: 16 },
  confirmationTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 20, color: color('#202124') },
  confirmationMessage: { fontFamily: 'Manrope-Regular', fontSize: 14, lineHeight: 21, color: color('#5f6368') },
  confirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  confirmationButton: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  deleteText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: color('#b3261e') },
  sheet: { backgroundColor: color('#fff'), borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 660, alignSelf: 'center', maxHeight: '92%' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 14 }, heading: { fontFamily: 'Manrope-Medium', fontSize: 16, color: color('#5f6368'), fontWeight: 'normal' },
  finish: { padding: 12 }, finishText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: color('#188038'), fontWeight: 'normal' }, content: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 8, gap: 16 },
  description: { fontFamily: 'Manrope-Regular', fontSize: 14, lineHeight: 20, color: color('#202124'), paddingVertical: 6, maxHeight: 120 },
  input: { fontFamily: 'Manrope-Regular', fontSize: 24, color: color('#202124'), paddingVertical: 10 }, label: { fontFamily: 'Manrope-Regular', fontSize: 15, color: color('#46534a') }, hint: { fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 20, color: color('#808b83') },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 }, stepButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: color('#e6f4ea'), alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.35 }, numberInput: { width: 70, paddingVertical: 10, borderRadius: 12, backgroundColor: color('#f3f6f4'), textAlign: 'center', fontFamily: 'Manrope-Regular', fontSize: 22, color: color('#253c2d') },
  actions: { flexDirection: 'row', gap: 12 }, dayButton: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: color('#f3f6f4'), flex: 1 }, checkedButton: { backgroundColor: color('#e6f4ea') }, dayLabel: { color: color('#188038'), fontFamily: 'Manrope-Medium', fontSize: 15, fontWeight: 'normal' },
});
