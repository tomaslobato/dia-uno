import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type TaskList } from '@/models/task-list';
import DateField from '@/components/date-field';
import { type Task, type TaskDraft, type TaskRepeatUnit } from '@/models/task';

type Props = { task?: Task; initialDate?: Date; lists: TaskList[]; initialListId: string | null; onSave: (draft: TaskDraft, id?: string) => void; onDelete: (id: string) => void; onClose: () => void; onToggle: (id: string) => void; onStar: (id: string) => void };

export default function TaskEditor({ task, initialDate, lists, initialListId, onSave, onDelete, onClose, onToggle, onStar }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  const insets = useSafeAreaInsets();
  const listScroll = useRef<ScrollView>(null);
  const titleInput = useRef<TextInput>(null);
  const closing = useRef(false);
  const [listId, setListId] = useState<string | null>(task ? task.listId : initialListId);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [date, setDate] = useState(() => {
    if (task) return task.dueAt ? new Date(task.dueAt) : null;
    if (initialDate) return initialDate;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  });
  const [hasTime, setHasTime] = useState(task?.hasTime ?? false);
  const [reminderEnabled, setReminderEnabled] = useState(task?.reminderMinutes !== null);
  const [reminderUnit, setReminderUnit] = useState<'minutes' | 'days'>(() => !task?.hasTime && Boolean(task?.reminderMinutes && task.reminderMinutes % 1440 === 0) ? 'days' : 'minutes');
  const [reminderInterval, setReminderInterval] = useState(() => {
    const minutes = task?.reminderMinutes ?? 30;
    return String(!task?.hasTime && minutes % 1440 === 0 ? minutes / 1440 : minutes);
  });
  const [repeatInterval, setRepeatInterval] = useState(task?.repeatEvery ? String(task.repeatEvery) : '1');
  const [repeatEnabled, setRepeatEnabled] = useState(Boolean(task?.repeatEvery));
  const [repeatUnit, setRepeatUnit] = useState<TaskRepeatUnit>(task?.repeatUnit ?? 'days');
  const focusTitle = useCallback(() => {
    titleInput.current?.focus();
  }, []);

  function changeReminderUnit(unit: 'minutes' | 'days') {
    if (unit === reminderUnit) return;
    const value = Number.parseInt(reminderInterval, 10) || 30;
    if (unit === 'days') setReminderInterval(String(Math.max(1, Math.min(7, Math.ceil(value / 1440)))));
    else setReminderInterval(String(Math.max(1, Math.min(10080, value * 1440))));
    setReminderUnit(unit);
  }

  function finish() {
    if (closing.current) return;
    if (!title.trim()) {
      cancel();
      return;
    }
    const repeatEvery = date && repeatEnabled ? Math.max(1, Math.min(10000, Number.parseInt(repeatInterval, 10) || 1)) : null;
    const reminderValue = Number.parseInt(reminderInterval, 10) || 30;
    const reminderMinutes = reminderEnabled ? Math.max(1, Math.min(10080, reminderValue * (reminderUnit === 'days' ? 1440 : 1))) : null;
    onSave({ listId, title, description, dueAt: date?.toISOString() ?? null, hasTime: Boolean(date && hasTime), repeatEvery, repeatUnit: repeatEvery ? repeatUnit : null, recurrenceId: task?.recurrenceId, reminderMinutes }, task?.id);
    closing.current = true;
    Keyboard.dismiss();
    onClose();
  }

  function cancel() {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    onClose();
  }

  function addDate(withTime: boolean) {
    Keyboard.dismiss();
    if (withTime) changeReminderUnit('minutes');
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
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={cancel}
      onShow={focusTitle}>
      <KeyboardAvoidingView style={styles.overlay} enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar sin guardar" onPress={cancel} />
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
            <TextInput ref={titleInput} value={title} onChangeText={setTitle} placeholder="¿Qué tenés que hacer?" placeholderTextColor={color('#9aa0a6')} style={[styles.title, styles.titleInput]} accessibilityLabel="Nombre de la tarea" maxLength={200} returnKeyType="done" onSubmitEditing={finish} />
              {task && <Pressable accessibilityRole="button" accessibilityLabel="Estrella de la tarea" aria-pressed={task.starred} accessibilityState={{ selected: task.starred }} onPress={() => onStar(task.id)} style={styles.starTarget}><MaterialIcons name={task.starred ? 'star' : 'star-border'} size={20} color={task.starred ? color('#1a73e8') : color('#80868b')} /></Pressable>}
            </View>
            <View style={styles.descriptionRow}>
              <MaterialIcons name="notes" size={22} color={color('#80868b')} style={styles.descriptionIcon} />
              <TextInput value={description} onChangeText={setDescription} placeholder="Añadir una descripción" placeholderTextColor={color('#80868b')} style={styles.description} accessibilityLabel="Descripción de la tarea" multiline maxLength={4000} textAlignVertical="top" />
            </View>
            {lists.length > 0 && <>
            <Text style={styles.dateLabel}>LISTA</Text>
            <ScrollView ref={listScroll} horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled" style={styles.listScroll} contentContainerStyle={styles.listOptions}>{[{ id: null, name: 'Todo' }, ...lists].map((list) => <Pressable key={list.id ?? 'no-list'} onLayout={(event) => { if (listId === list.id) listScroll.current?.scrollTo({ x: Math.max(0, event.nativeEvent.layout.x - 4), animated: false }); }} accessibilityRole="radio" accessibilityLabel={`Guardar en ${list.name}`} accessibilityState={{ checked: listId === list.id }} aria-checked={listId === list.id} onPress={() => setListId(list.id)} style={[styles.option, styles.listOption, listId === list.id && styles.optionSelected]}><MaterialIcons name="list" size={18} color={color(listId === list.id ? '#1a73e8' : '#5f6368')} /><Text numberOfLines={1} style={[styles.optionText, { flexShrink: 1 }, listId === list.id && styles.optionTextSelected]}>{list.name}</Text></Pressable>)}</ScrollView>
            </>}
            <View style={styles.divider} />
            <View style={styles.dateHeader}>
              <Text style={styles.dateLabel}>CUÁNDO</Text>
              {date && <Pressable onPress={() => { setDate(null); setHasTime(false); setRepeatEnabled(false); }} accessibilityRole="button" accessibilityLabel="Quitar fecha" hitSlop={8}><Text style={styles.removeDate}>Quitar fecha</Text></Pressable>}
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
            {date && <View style={styles.scheduleSections}>
              <View style={[styles.scheduleColumn, styles.repeatColumn]}>
                <Text style={styles.dateLabel}>REPETIR</Text>
                <Pressable onPress={() => setRepeatEnabled((enabled) => !enabled)} accessibilityRole="switch" accessibilityLabel="Repetir tarea" accessibilityState={{ checked: repeatEnabled }} style={[styles.sectionToggle, repeatEnabled && styles.optionSelected]}>
                  <MaterialIcons name="repeat" size={16} color={color(repeatEnabled ? '#1a73e8' : '#80868b')} />
                  <Text style={[styles.removeDate, repeatEnabled && styles.optionTextSelected]}>{repeatEnabled ? 'Quitar' : 'No repetir'}</Text>
                </Pressable>
                {repeatEnabled && <>
                  <Text style={styles.repeatLabel}>Repetir cada</Text>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setRepeatInterval(String(Math.max(1, (Number.parseInt(repeatInterval, 10) || 1) - 1)))} accessibilityRole="button" accessibilityLabel="Reducir intervalo" style={styles.stepperButton}><MaterialIcons name="remove" size={18} color={color('#5f6368')} /></Pressable>
                    <TextInput value={repeatInterval} onChangeText={(value) => setRepeatInterval(value.replace(/[^0-9]/g, '').slice(0, 5))} onBlur={() => setRepeatInterval(String(Math.max(1, Math.min(10000, Number.parseInt(repeatInterval, 10) || 1))))} keyboardType="number-pad" selectTextOnFocus accessibilityLabel="Repetir cada cantidad" style={styles.intervalInput} maxLength={5} />
                    <Pressable onPress={() => setRepeatInterval(String(Math.min(10000, (Number.parseInt(repeatInterval, 10) || 0) + 1)))} accessibilityRole="button" accessibilityLabel="Aumentar intervalo" style={styles.stepperButton}><MaterialIcons name="add" size={18} color={color('#5f6368')} /></Pressable>
                  </View>
                  <View style={styles.unitOptions}>
                    {([{ value: 'days', label: 'Días' }, { value: 'weeks', label: 'Semanas' }, { value: 'months', label: 'Meses' }] as const).map((option) => <Pressable key={option.value} onPress={() => setRepeatUnit(option.value)} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: repeatUnit === option.value }} aria-checked={repeatUnit === option.value} style={[styles.unitOption, repeatUnit === option.value && styles.optionSelected]}>
                      <Text style={[styles.optionText, repeatUnit === option.value && styles.optionTextSelected]}>{option.label}</Text>
                    </Pressable>)}
                  </View>
                  <Text style={styles.recurrenceHint}>Al completarla, se creará la siguiente.</Text>
                </>}
              </View>
              <View style={styles.scheduleColumn}>
                <Text style={styles.dateLabel}>RECORDATORIO</Text>
                <Pressable onPress={() => setReminderEnabled((enabled) => !enabled)} accessibilityRole="switch" accessibilityLabel="Recordatorio de la tarea" accessibilityState={{ checked: reminderEnabled }} style={[styles.sectionToggle, reminderEnabled && styles.optionSelected]}>
                  <MaterialIcons name={reminderEnabled ? 'notifications-active' : 'notifications-off'} size={16} color={color(reminderEnabled ? '#1a73e8' : '#80868b')} />
                  <Text style={[styles.removeDate, reminderEnabled && styles.optionTextSelected]}>{reminderEnabled ? 'Desactivar' : 'Activar'}</Text>
                </Pressable>
                {reminderEnabled && hasTime ? <>
                  <Text style={styles.repeatLabel}>Minutos antes</Text>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setReminderInterval(String(Math.max(1, (Number.parseInt(reminderInterval, 10) || 30) - 1)))} accessibilityRole="button" accessibilityLabel="Reducir minutos del recordatorio" style={styles.stepperButton}><MaterialIcons name="remove" size={18} color={color('#5f6368')} /></Pressable>
                    <TextInput value={reminderInterval} onChangeText={(value) => setReminderInterval(value.replace(/[^0-9]/g, '').slice(0, 5))} onBlur={() => setReminderInterval(String(Math.max(1, Math.min(10080, Number.parseInt(reminderInterval, 10) || 30))))} keyboardType="number-pad" selectTextOnFocus accessibilityLabel="Minutos antes de la tarea" style={styles.intervalInput} maxLength={5} />
                    <Pressable onPress={() => setReminderInterval(String(Math.min(10080, (Number.parseInt(reminderInterval, 10) || 0) + 1)))} accessibilityRole="button" accessibilityLabel="Aumentar minutos del recordatorio" style={styles.stepperButton}><MaterialIcons name="add" size={18} color={color('#5f6368')} /></Pressable>
                  </View>
                </> : reminderEnabled ? <>
                  <View style={styles.reminderUnits}>
                    {([{ value: 'minutes', label: 'Minutos' }, { value: 'days', label: 'Días' }] as const).map((option) => <Pressable key={option.value} onPress={() => changeReminderUnit(option.value)} accessibilityRole="radio" accessibilityLabel={`${option.label} antes`} accessibilityState={{ checked: reminderUnit === option.value }} aria-checked={reminderUnit === option.value} style={[styles.unitOption, reminderUnit === option.value && styles.optionSelected]}>
                      <Text style={[styles.optionText, reminderUnit === option.value && styles.optionTextSelected]}>{option.label}</Text>
                    </Pressable>)}
                  </View>
                  <Text style={styles.repeatLabel}>{reminderUnit === 'days' ? 'Días antes' : 'Minutos antes'}</Text>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setReminderInterval(String(Math.max(1, (Number.parseInt(reminderInterval, 10) || 1) - 1)))} accessibilityRole="button" accessibilityLabel={`Reducir ${reminderUnit === 'days' ? 'días' : 'minutos'} del recordatorio`} style={styles.stepperButton}><MaterialIcons name="remove" size={18} color={color('#5f6368')} /></Pressable>
                    <TextInput value={reminderInterval} onChangeText={(value) => setReminderInterval(value.replace(/[^0-9]/g, '').slice(0, 5))} onBlur={() => setReminderInterval(String(Math.max(1, Math.min(reminderUnit === 'days' ? 7 : 10080, Number.parseInt(reminderInterval, 10) || 1))))} keyboardType="number-pad" selectTextOnFocus accessibilityLabel={reminderUnit === 'days' ? 'Días antes de la tarea' : 'Minutos antes de la tarea'} style={styles.intervalInput} maxLength={5} />
                    <Pressable onPress={() => setReminderInterval(String(Math.min(reminderUnit === 'days' ? 7 : 10080, (Number.parseInt(reminderInterval, 10) || 0) + 1)))} accessibilityRole="button" accessibilityLabel={`Aumentar ${reminderUnit === 'days' ? 'días' : 'minutos'} del recordatorio`} style={styles.stepperButton}><MaterialIcons name="add" size={18} color={color('#5f6368')} /></Pressable>
                  </View>
                </> : null}
              </View>
            </View>}
            <View style={styles.hint}><MaterialIcons name="done-all" size={16} color={color('#80868b')} /><Text style={styles.hintText}>Toca Listo para guardar los cambios.</Text></View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: color('#20212466'), justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 600, alignSelf: 'center', maxHeight: '92%', backgroundColor: color('#fff'), borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, boxShadow: '0px -4px 30px rgba(32,33,36,0.08)' },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: color('#dadce0'), alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  eyebrow: { fontFamily: 'Manrope-SemiBold', fontSize: 11, letterSpacing: 1.5, color: color('#80868b'), fontWeight: 'normal' },
  done: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  deleteLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: color('#b3261e'), fontWeight: 'normal' },
  doneLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: color('#1a73e8'), fontWeight: 'normal' },
  form: { gap: 14, paddingBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleInput: { flex: 1, minWidth: 0 },
  completeTarget: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  starTarget: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  title: { fontFamily: 'Manrope-Medium', fontSize: 23, lineHeight: 30, color: color('#202124'), fontWeight: 'normal', padding: 0, minHeight: 38 },
  descriptionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  descriptionIcon: { marginTop: 3 },
  description: { flex: 1, fontFamily: 'Manrope-Regular', fontSize: 15, lineHeight: 23, minHeight: 52, maxHeight: 150, color: color('#5f6368'), padding: 0 },
  divider: { height: 1, backgroundColor: color('#edf0f3') },
  dateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 10, color: color('#80868b'), letterSpacing: 1.3, fontWeight: 'normal' },
  removeDate: { fontFamily: 'Manrope-Regular', fontSize: 12, color: color('#5f6368') },
  listScroll: { width: '100%', flexGrow: 0 },
  listOptions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 5 },
  listOption: { flexShrink: 0, maxWidth: 240 },
  options: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  option: { maxWidth: '100%', flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderColor: color('#e1e5ea'), borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  optionSelected: { backgroundColor: color('#e8f0fe'), borderColor: color('#e8f0fe') },
  optionText: { color: color('#5f6368'), fontFamily: 'Manrope-Medium', fontSize: 13, fontWeight: 'normal' },
  optionTextSelected: { color: color('#185abc') },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  hintText: { color: color('#80868b'), fontFamily: 'Manrope-Regular', fontSize: 11, flexShrink: 1 },
  recurrenceHint: { color: color('#80868b'), fontFamily: 'Manrope-Regular', fontSize: 11, marginTop: -8 },
  repeatToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 38, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: color('#e8f0fe') },
  scheduleSections: { flexDirection: 'row', gap: 14 },
  scheduleColumn: { flex: 1, minWidth: 0, gap: 8, alignItems: 'flex-start' },
  repeatColumn: { borderRightWidth: 1, borderRightColor: color('#edf0f3'), paddingRight: 12 },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36, maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 12, backgroundColor: color('#f1f4f2') },
  reminderUnits: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  repeatLabel: { fontFamily: 'Manrope-Medium', fontSize: 13, color: color('#5f6368') },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: color('#e1e5ea'), borderRadius: 12, height: 40 },
  stepperButton: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  intervalInput: { width: 34, padding: 0, textAlign: 'center', fontFamily: 'Manrope-Medium', fontSize: 14, color: color('#202124') },
  unitOptions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unitOption: { borderWidth: 1, borderColor: color('#e1e5ea'), borderRadius: 16, paddingHorizontal: 9, paddingVertical: 8 },
});
