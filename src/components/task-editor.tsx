import Pressable from '@/components/feedback-pressable';
import TaskScheduleModal, { type ScheduleDraft } from '@/components/task-schedule-modal';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey } from '@/models/habit';
import { type TaskList } from '@/models/task-list';
import { isOccurrenceCompleted, isRecurringTask, type Task, type TaskDeleteScope, type TaskDraft, type TaskRepeatUnit } from '@/models/task';

type Props = {
  task?: Task;
  /** Calendar day of the occurrence being edited (for recurring complete/delete). */
  occurrenceDay?: string;
  initialDate?: Date;
  lists: TaskList[];
  initialListId: string | null;
  onSave: (draft: TaskDraft, id?: string) => void;
  onDelete: (id: string, scope?: TaskDeleteScope) => void;
  onClose: () => void;
  onToggle: (id: string) => void;
  onStar: (id: string) => void;
};

export default function TaskEditor({ task, occurrenceDay, initialDate, initialListId, onSave, onDelete, onClose, onToggle }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  const insets = useSafeAreaInsets();
  const titleInput = useRef<TextInput>(null);
  const descriptionInput = useRef<TextInput>(null);
  const closing = useRef(false);
  const [listId] = useState<string | null>(task ? task.listId : initialListId);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [showDescription, setShowDescription] = useState(Boolean(task?.description));
  const [starred, setStarred] = useState(task?.starred ?? false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [date, setDate] = useState<Date | null>(() => {
    if (task) return task.dueAt ? new Date(task.dueAt) : null;
    if (initialDate) return initialDate;
    return null;
  });
  const [hasTime, setHasTime] = useState(task?.hasTime ?? false);
  const [repeatEnabled, setRepeatEnabled] = useState(Boolean(task?.repeatEvery));
  const [repeatInterval, setRepeatInterval] = useState(task?.repeatEvery ? String(task.repeatEvery) : '1');
  const [repeatUnit, setRepeatUnit] = useState<TaskRepeatUnit>(task?.repeatUnit ?? 'days');
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>(() => {
    if (task?.repeatWeekdays?.length) return task.repeatWeekdays;
    const seed = task?.dueAt ? new Date(task.dueAt) : initialDate;
    return seed ? [seed.getDay()] : [];
  });
  const [repeatEndsAt, setRepeatEndsAt] = useState<Date | null>(() => (
    task?.repeatEndsAt ? new Date(`${task.repeatEndsAt}T12:00:00`) : null
  ));

  const focusTitle = useCallback(() => {
    const run = () => {
      titleInput.current?.focus();
    };
    // Android Modals often miss the first focus; retry after the sheet is interactive.
    requestAnimationFrame(() => {
      run();
      setTimeout(run, Platform.OS === 'android' ? 280 : 80);
      setTimeout(run, Platform.OS === 'android' ? 500 : 160);
    });
  }, []);

  function finish() {
    if (closing.current) return;
    if (!title.trim()) {
      cancel();
      return;
    }
    const repeatEvery = date && repeatEnabled ? Math.max(1, Math.min(99, Number.parseInt(repeatInterval, 10) || 1)) : null;
    const unit = repeatEvery ? repeatUnit : null;
    onSave({
      listId,
      title,
      description,
      dueAt: date?.toISOString() ?? null,
      hasTime: Boolean(date && hasTime),
      starred,
      repeatEvery,
      repeatUnit: unit,
      repeatWeekdays: unit === 'weeks' ? (repeatWeekdays.length ? repeatWeekdays : date ? [date.getDay()] : []) : [],
      repeatEndsAt: repeatEvery && repeatEndsAt ? dayKey(repeatEndsAt) : null,
      recurrenceId: task?.recurrenceId,
      reminderMinutes: task?.reminderMinutes === undefined ? (date ? 30 : null) : task.reminderMinutes,
    }, task?.id);
    closing.current = true;
    Keyboard.dismiss();
    onClose();
  }

  function cancel() {
    if (closing.current) return;
    if (confirmDelete) {
      setConfirmDelete(false);
      return;
    }
    closing.current = true;
    Keyboard.dismiss();
    onClose();
  }

  function openDescription() {
    setShowDescription(true);
    requestAnimationFrame(() => descriptionInput.current?.focus());
  }

  function applySchedule(draft: ScheduleDraft) {
    setDate(draft.date);
    setHasTime(draft.hasTime);
    setRepeatEnabled(draft.repeatEnabled);
    setRepeatInterval(String(draft.repeatEvery));
    setRepeatUnit(draft.repeatUnit);
    setRepeatWeekdays(draft.repeatWeekdays);
    setRepeatEndsAt(draft.repeatEndsAt);
    setScheduleOpen(false);
    focusTitle();
  }

  function requestDelete() {
    if (!task || closing.current) return;
    Keyboard.dismiss();
    if (isRecurringTask(task)) {
      setConfirmDelete(true);
      return;
    }
    closing.current = true;
    onDelete(task.id, 'all');
    onClose();
  }

  function confirmDeleteScope(scope: TaskDeleteScope) {
    if (!task || closing.current) return;
    closing.current = true;
    onDelete(task.id, scope);
    onClose();
  }

  const scheduleActive = Boolean(date);
  const scheduleLabel = !date
    ? null
    : [
        date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        hasTime ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : null,
      ].filter(Boolean).join(' · ');
  const completed = Boolean(
    task && occurrenceDay && isRecurringTask(task)
      ? isOccurrenceCompleted(task, occurrenceDay)
      : task?.completed,
  );
  const recurring = Boolean(task && isRecurringTask(task));

  function toggleCompleted() {
    if (!task || closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    onToggle(task.id);
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={cancel} onShow={focusTitle}>
      <KeyboardAvoidingView style={[styles.overlay, confirmDelete && styles.confirmationOverlay]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={confirmDelete ? 'Cerrar sin eliminar' : 'Cerrar sin guardar'} onPress={cancel} />
        {confirmDelete && task ? (
          <View style={styles.confirmation} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={styles.confirmationTitle}>Eliminar tarea recurrente</Text>
            <Text style={styles.confirmationMessage}>
              {occurrenceDay
                ? `¿Qué quieres eliminar de “${title || task.title}”?`
                : `¿Qué quieres eliminar de “${title || task.title}”?`}
            </Text>
            <View style={styles.confirmationChoices}>
              <Pressable accessibilityRole="button" accessibilityLabel="Eliminar solo esta ocurrencia" onPress={() => confirmDeleteScope('this')} style={styles.choiceButton}>
                <Text style={styles.choiceText}>Solo esta</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Eliminar esta y las siguientes" onPress={() => confirmDeleteScope('future')} style={styles.choiceButton}>
                <Text style={styles.choiceText}>Esta y las siguientes</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Eliminar toda la serie" onPress={() => confirmDeleteScope('all')} style={styles.choiceButton}>
                <Text style={styles.choiceDanger}>Todas</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={() => setConfirmDelete(false)} style={styles.confirmationCancel}>
              <Text style={styles.finishText}>Cancelar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              {task ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={completed ? `Marcar como pendiente: ${title || task.title}` : `Completar: ${title || task.title}`}
                  accessibilityState={{ checked: completed }}
                  onPress={toggleCompleted}
                  style={styles.checkTarget}
                >
                  <View style={[styles.checkbox, completed && styles.checkboxDone]}>
                    {completed && <MaterialIcons name="check" size={14} color="#fff" />}
                  </View>
                </Pressable>
              ) : null}
              <TextInput
                ref={titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Nueva tarea"
                placeholderTextColor={color('#9aa0a6')}
                style={[styles.title, completed && styles.titleCompleted]}
                accessibilityLabel="Nombre de la tarea"
                maxLength={200}
                returnKeyType="done"
                onSubmitEditing={finish}
                showSoftInputOnFocus
                blurOnSubmit={false}
                importantForAutofill="no"
              />
            </View>
            {showDescription && (
              <TextInput
                ref={descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Añadir detalles"
                placeholderTextColor={color('#80868b')}
                style={styles.description}
                accessibilityLabel="Descripción de la tarea"
                multiline
                maxLength={4000}
                textAlignVertical="top"
              />
            )}
            {scheduleLabel && (
              <View style={styles.scheduleHint}>
                <Text style={styles.scheduleHintText}>{scheduleLabel}</Text>
                {(repeatEnabled || recurring) && <MaterialIcons name="repeat" size={14} color={color('#1a73e8')} />}
              </View>
            )}
            <View style={styles.toolbar}>
              <View style={styles.tools}>
                <Pressable accessibilityRole="button" accessibilityLabel="Descripción" accessibilityState={{ selected: showDescription }} onPress={openDescription} style={[styles.tool, showDescription && styles.toolActive]}>
                  <MaterialIcons name="notes" size={22} color={color(showDescription || description ? '#1a73e8' : '#5f6368')} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Fecha y hora" accessibilityState={{ selected: scheduleActive }} onPress={() => { Keyboard.dismiss(); setScheduleOpen(true); }} style={[styles.tool, scheduleActive && styles.toolActive]}>
                  <MaterialIcons name="schedule" size={22} color={color(scheduleActive ? '#1a73e8' : '#5f6368')} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Importante" accessibilityState={{ selected: starred }} onPress={() => setStarred((current) => !current)} style={[styles.tool, starred && styles.toolActive]}>
                  <MaterialIcons name={starred ? 'star' : 'star-border'} size={22} color={color(starred ? '#1a73e8' : '#5f6368')} />
                </Pressable>
                {task && <Pressable accessibilityRole="button" accessibilityLabel="Eliminar tarea" onPress={requestDelete} style={styles.tool}>
                  <MaterialIcons name="delete-outline" size={22} color={color('#b3261e')} />
                </Pressable>}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Guardar" onPress={finish} style={[styles.save, !title.trim() && styles.saveDisabled]} disabled={!title.trim()}>
                <Text style={styles.saveText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      {scheduleOpen && <TaskScheduleModal
        initial={{
          date,
          hasTime,
          repeatEnabled,
          repeatEvery: Number.parseInt(repeatInterval, 10) || 1,
          repeatUnit,
          repeatWeekdays,
          repeatEndsAt,
        }}
        onClose={() => { setScheduleOpen(false); focusTitle(); }}
        onDone={applySchedule}
      />}
    </Modal>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: color('#20212466'), justifyContent: 'flex-end' },
  confirmationOverlay: { justifyContent: 'center', paddingHorizontal: 24 },
  confirmation: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: color('#fff'), borderRadius: 24, padding: 24, gap: 12 },
  confirmationTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 20, color: color('#202124') },
  confirmationMessage: { fontFamily: 'Manrope-Regular', fontSize: 14, lineHeight: 21, color: color('#5f6368') },
  confirmationChoices: { gap: 4, marginTop: 4 },
  choiceButton: { paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12 },
  choiceText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: color('#1a73e8') },
  choiceDanger: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: color('#b3261e') },
  confirmationCancel: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 12 },
  finishText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: color('#5f6368') },
  sheet: { width: '100%', maxWidth: 600, alignSelf: 'center', backgroundColor: color('#fff'), borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, gap: 10, boxShadow: '0px -4px 30px rgba(32,33,36,0.08)' },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: color('#dadce0'), alignSelf: 'center', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkTarget: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 22, height: 22, borderWidth: 1.7, borderColor: color('#a8b1be'), borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: color('#fff') },
  checkboxDone: { backgroundColor: color('#1a73e8'), borderColor: color('#1a73e8') },
  title: { flex: 1, minWidth: 0, fontFamily: 'Manrope-Medium', fontSize: 20, lineHeight: 28, color: color('#202124'), paddingVertical: 6, paddingHorizontal: 2, minHeight: 40 },
  titleCompleted: { color: color('#8b919b'), textDecorationLine: 'line-through' },
  description: { fontFamily: 'Manrope-Regular', fontSize: 15, lineHeight: 22, color: color('#5f6368'), minHeight: 72, maxHeight: 140, paddingHorizontal: 2, paddingVertical: 4 },
  scheduleHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  scheduleHintText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#1a73e8') },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 4 },
  tools: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tool: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolActive: { backgroundColor: color('#e8f0fe') },
  save: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16, backgroundColor: color('#1a73e8') },
  saveDisabled: { opacity: 0.4 },
  saveText: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: '#fff' },
});
