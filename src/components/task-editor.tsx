import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DateField from '@/components/date-field';
import { type Task, type TaskDraft } from '@/models/task';

type Props = { task?: Task; onSave: (draft: TaskDraft, id?: string) => void; onDelete: (id: string) => void; onClose: () => void; onToggle: (id: string) => void; onStar: (id: string) => void };

export default function TaskEditor({ task, onSave, onDelete, onClose, onToggle, onStar }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  const insets = useSafeAreaInsets();
  const titleInput = useRef<TextInput>(null);
  const closing = useRef(false);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [date, setDate] = useState(task?.dueAt ? new Date(task.dueAt) : null);
  const [hasTime, setHasTime] = useState(task?.hasTime ?? false);
  const [invalid, setInvalid] = useState(false);
  const focusTitle = useCallback(() => {
    titleInput.current?.focus();
  }, []);

  function finish() {
    if (closing.current) return;
    if (!title.trim()) {
      if (description.trim() || date || task) {
        setInvalid(true);
        titleInput.current?.focus();
        return;
      }
    } else {
      onSave({ title, description, dueAt: date?.toISOString() ?? null, hasTime: Boolean(date && hasTime) }, task?.id);
    }
    closing.current = true;
    Keyboard.dismiss();
    onClose();
  }

  function addDate(withTime: boolean) {
    Keyboard.dismiss();
    if (!date) {
      const initial = new Date();
      initial.setHours(withTime ? initial.getHours() + 1 : 12, 0, 0, 0);
      setDate(initial);
    }
    setHasTime(withTime);
  }

  function removeTask() {
    if (!task || closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    onDelete(task.id);
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={finish}
      onShow={focusTitle}>
      <KeyboardAvoidingView style={styles.overlay} enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Guardar tarea y cerrar" onPress={finish} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{task ? 'EDITAR TAREA' : 'NUEVA TAREA'}</Text>
            <View style={styles.actions}>
            {task && <Pressable onPress={removeTask} accessibilityRole="button" accessibilityLabel="Eliminar tarea" hitSlop={8} style={styles.done}>
              <MaterialIcons name="close" size={19} color={color('#b3261e')} />
              <Text style={styles.deleteLabel}>Eliminar</Text>
            </Pressable>}
            <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Listo, guardar tarea" hitSlop={8} style={styles.done}>
              <MaterialIcons name="check" size={20} color={color('#1a73e8')} />
              <Text style={styles.doneLabel}>Listo</Text>
            </Pressable>
            </View>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
            <View style={styles.titleRow}>
              {task && <Pressable accessibilityRole="checkbox" accessibilityLabel="Tarea completada" aria-checked={task.completed} accessibilityState={{ checked: task.completed }} onPress={() => onToggle(task.id)} style={styles.completeTarget}><MaterialIcons name={task.completed ? 'check-circle' : 'radio-button-unchecked'} size={26} color={color('#1a73e8')} /></Pressable>}
            <TextInput ref={titleInput} value={title} onChangeText={(text) => { setTitle(text); setInvalid(false); }} placeholder="¿Qué tenés que hacer?" placeholderTextColor={color('#9aa0a6')} style={[styles.title, styles.titleInput]} accessibilityLabel="Nombre de la tarea" maxLength={200} returnKeyType="done" onSubmitEditing={finish} />
              {task && <Pressable accessibilityRole="button" accessibilityLabel="Estrella de la tarea" aria-pressed={task.starred} accessibilityState={{ selected: task.starred }} onPress={() => onStar(task.id)} style={styles.starTarget}><MaterialIcons name={task.starred ? 'star' : 'star-border'} size={20} color={task.starred ? color('#1a73e8') : color('#80868b')} /></Pressable>}
            </View>
            {invalid && <Text accessibilityRole="alert" style={styles.validation}>Dale un nombre a tu tarea para guardarla.</Text>}
            <View style={styles.descriptionRow}>
              <MaterialIcons name="notes" size={22} color={color('#80868b')} style={styles.descriptionIcon} />
              <TextInput value={description} onChangeText={setDescription} placeholder="Añadir una descripción" placeholderTextColor={color('#80868b')} style={styles.description} accessibilityLabel="Descripción de la tarea" multiline maxLength={4000} textAlignVertical="top" />
            </View>
            <View style={styles.divider} />
            <View style={styles.dateHeader}>
              <Text style={styles.dateLabel}>CUÁNDO</Text>
              {date && <Pressable onPress={() => { setDate(null); setHasTime(false); }} accessibilityRole="button" accessibilityLabel="Quitar fecha" hitSlop={8}><Text style={styles.removeDate}>Quitar fecha</Text></Pressable>}
            </View>
            <View style={styles.options}>
              <Pressable onPress={() => addDate(false)} accessibilityRole="button" accessibilityLabel="Solo fecha" accessibilityState={{ selected: Boolean(date && !hasTime) }} style={[styles.option, date && !hasTime && styles.optionSelected]}>
                <MaterialIcons name="calendar-today" size={17} color={date && !hasTime ? color('#1a73e8') : color('#5f6368')} />
                <Text style={[styles.optionText, date && !hasTime && styles.optionTextSelected]}>Solo fecha</Text>
              </Pressable>
              <Pressable onPress={() => addDate(true)} accessibilityRole="button" accessibilityLabel="Fecha y hora" accessibilityState={{ selected: Boolean(date && hasTime) }} style={[styles.option, date && hasTime && styles.optionSelected]}>
                <MaterialIcons name="schedule" size={18} color={date && hasTime ? color('#1a73e8') : color('#5f6368')} />
                <Text style={[styles.optionText, date && hasTime && styles.optionTextSelected]}>Fecha y hora</Text>
              </Pressable>
            </View>
            {date && <DateField value={date} hasTime={hasTime} onChange={setDate} />}
            <View style={styles.hint}><MaterialIcons name="done-all" size={16} color={color('#80868b')} /><Text style={styles.hintText}>Se guarda automáticamente al tocar fuera.</Text></View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: color('#20212466'), justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 600, alignSelf: 'center', maxHeight: '92%', backgroundColor: color('#fff'), borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, boxShadow: '0px -4px 30px rgba(32,33,36,0.08)' },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: color('#dadce0'), alignSelf: 'center', marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, color: color('#80868b'), fontWeight: '600' },
  done: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  deleteLabel: { fontSize: 14, color: color('#b3261e'), fontWeight: '600' },
  doneLabel: { fontSize: 14, color: color('#1a73e8'), fontWeight: '600' },
  form: { gap: 18, paddingBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleInput: { flex: 1, minWidth: 0 },
  completeTarget: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  starTarget: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  title: { fontSize: 23, lineHeight: 30, color: color('#202124'), fontWeight: '500', padding: 0, minHeight: 38 },
  validation: { fontSize: 13, color: color('#b3261e') },
  descriptionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  descriptionIcon: { marginTop: 3 },
  description: { flex: 1, fontSize: 15, lineHeight: 23, minHeight: 64, maxHeight: 150, color: color('#5f6368'), padding: 0 },
  divider: { height: 1, backgroundColor: color('#edf0f3') },
  dateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLabel: { fontSize: 10, color: color('#80868b'), letterSpacing: 1.3, fontWeight: '600' },
  removeDate: { fontSize: 12, color: color('#5f6368') },
  options: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  option: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderColor: color('#e1e5ea'), borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  optionSelected: { backgroundColor: color('#e8f0fe'), borderColor: color('#e8f0fe') },
  optionText: { color: color('#5f6368'), fontSize: 13, fontWeight: '500' },
  optionTextSelected: { color: color('#185abc') },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  hintText: { color: color('#80868b'), fontSize: 11, flexShrink: 1 },
});
