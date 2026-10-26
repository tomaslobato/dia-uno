import Pressable from '@/components/feedback-pressable';
import TaskScheduleModal, { type ScheduleDraft } from '@/components/task-schedule-modal';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey } from '@/models/habit';
import { type TaskList } from '@/models/task-list';
import { isOccurrenceCompleted, isRecurringTask, type Task, type TaskDraft, type TaskRepeatUnit } from '@/models/task';

type Props = {
  task?: Task;
  /** Calendar day of the occurrence being edited (for recurring complete). */
  occurrenceDay?: string;
  initialDate?: Date;
  lists: TaskList[];
  initialListId: string | null;
  onSave: (draft: TaskDraft, id?: string) => void;
  onClose: () => void;
  onToggle: (id: string) => void;
  onStar: (id: string) => void;
};

export default function TaskEditor({ task, occurrenceDay, initialDate, lists, initialListId, onSave, onClose, onToggle }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const titleInput = useRef<TextInput>(null);
  const descriptionInput = useRef<TextInput>(null);
  const closing = useRef(false);
  const [listId, setListId] = useState<string | null>(task ? task.listId : initialListId);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [showDescription, setShowDescription] = useState(Boolean(task?.description));
  const [expanded, setExpanded] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState(0);
  const [starred, setStarred] = useState(task?.starred ?? false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [listPickerOpen, setListPickerOpen] = useState(false);
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
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const descriptionRef = useRef(description);
  descriptionRef.current = description;
  const animatingRef = useRef(false);
  const collapsedHeightRef = useRef(0);
  const [expandProgress] = useState(() => new Animated.Value(0));
  const [enterProgress] = useState(() => new Animated.Value(0));
  const [heightDriven, setHeightDriven] = useState(false);

  const almostFullHeight = Math.max(420, windowHeight - Math.max(insets.top, 10) - 8);
  const sheetPaddingBottom = Math.max(insets.bottom, 12);

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

  const focusDescription = useCallback(() => {
    requestAnimationFrame(() => {
      descriptionInput.current?.focus();
      setTimeout(() => descriptionInput.current?.focus(), Platform.OS === 'android' ? 200 : 60);
    });
  }, []);

  const expandComposer = useCallback(() => {
    if (animatingRef.current || expandedRef.current) return;
    const from = collapsedHeightRef.current || collapsedHeight || 200;
    collapsedHeightRef.current = from;
    setCollapsedHeight(from);
    setHeightDriven(true);
    setShowDescription(true);
    setExpanded(true);
    expandProgress.setValue(0);
    animatingRef.current = true;
    Animated.timing(expandProgress, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      animatingRef.current = false;
      if (finished) focusDescription();
    });
  }, [collapsedHeight, expandProgress, focusDescription]);

  const collapseComposer = useCallback(() => {
    if (animatingRef.current || !expandedRef.current) return;
    Keyboard.dismiss();
    animatingRef.current = true;
    Animated.timing(expandProgress, {
      toValue: 0,
      duration: 300,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      animatingRef.current = false;
      if (!finished) return;
      setExpanded(false);
      if (!descriptionRef.current.trim()) {
        setShowDescription(false);
        setHeightDriven(false);
        setCollapsedHeight(0);
        collapsedHeightRef.current = 0;
      }
      focusTitle();
    });
  }, [expandProgress, focusTitle]);

  function toggleDescription() {
    if (expanded) collapseComposer();
    else expandComposer();
  }

  const expandComposerRef = useRef(expandComposer);
  expandComposerRef.current = expandComposer;
  const collapseComposerRef = useRef(collapseComposer);
  collapseComposerRef.current = collapseComposer;

  const handlePan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy < -36 || gesture.vy < -0.45) {
        if (!expandedRef.current) expandComposerRef.current();
        return;
      }
      if (gesture.dy > 36 || gesture.vy > 0.45) {
        if (expandedRef.current) collapseComposerRef.current();
      }
    },
  }), []);

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
    Animated.timing(enterProgress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose());
  }

  function cancel() {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    Animated.timing(enterProgress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose());
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

  const scheduleActive = Boolean(date);
  const scheduleLabel = !date
    ? null
    : [
        date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        hasTime ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : null,
      ].filter(Boolean).join(' · ');
  const selectedList = listId ? lists.find((list) => list.id === listId) : undefined;
  const completed = Boolean(
    task && occurrenceDay && isRecurringTask(task)
      ? isOccurrenceCompleted(task, occurrenceDay)
      : task?.completed,
  );
  const recurring = Boolean(task && isRecurringTask(task));

  function pickList(next: string | null) {
    setListId(next);
    setListPickerOpen(false);
    focusTitle();
  }

  function toggleCompleted() {
    if (!task || closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    onToggle(task.id);
    Animated.timing(enterProgress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose());
  }

  const measuredCollapsed = Math.max(collapsedHeight || collapsedHeightRef.current, 160);
  const animatedHeight = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [measuredCollapsed, almostFullHeight],
  });

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={cancel}
      onShow={() => {
        enterProgress.setValue(0);
        Animated.timing(enterProgress, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) focusTitle();
        });
      }}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar sin guardar" onPress={cancel} />
        <Animated.View
          style={{
            width: '100%',
            maxWidth: 600,
            alignSelf: 'center',
            opacity: enterProgress,
            transform: [{
              translateY: enterProgress.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }),
            }],
          }}
        >
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: sheetPaddingBottom },
              heightDriven ? { height: animatedHeight } : null,
            ]}
            accessibilityViewIsModal
            onLayout={(event) => {
              if (expandedRef.current || animatingRef.current) return;
              const height = Math.round(event.nativeEvent.layout.height);
              if (height < 100) return;
              collapsedHeightRef.current = height;
              if (Math.abs(height - collapsedHeight) > 2) setCollapsedHeight(height);
            }}
          >
            <View
              {...handlePan.panHandlers}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Redimensionar editor"
              accessibilityHint={expanded ? 'Desliza hacia abajo para el modo compacto' : 'Desliza hacia arriba para escribir una nota'}
              style={styles.handleHit}
            >
              <View style={styles.handle} />
            </View>
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
                style={[styles.description, expanded && styles.descriptionExpanded]}
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Descripción"
                  accessibilityState={{ selected: expanded || showDescription }}
                  accessibilityHint={expanded ? 'Volver al modo compacto' : 'Abrir nota a pantalla casi completa'}
                  onPress={toggleDescription}
                  style={[styles.tool, (expanded || showDescription || description) && styles.toolActive]}
                >
                  <MaterialIcons name="notes" size={22} color={color(expanded || showDescription || description ? '#1a73e8' : '#5f6368')} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Fecha y hora" accessibilityState={{ selected: scheduleActive }} onPress={() => { Keyboard.dismiss(); setScheduleOpen(true); }} style={[styles.tool, scheduleActive && styles.toolActive]}>
                  <MaterialIcons name="schedule" size={22} color={color(scheduleActive ? '#1a73e8' : '#5f6368')} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={selectedList ? `Lista: ${selectedList.name}` : 'Elegir lista'}
                  accessibilityState={{ selected: Boolean(listId) }}
                  onPress={() => { Keyboard.dismiss(); setListPickerOpen(true); }}
                  style={[styles.tool, listId && styles.toolActive]}
                >
                  <MaterialIcons name="list" size={22} color={color(listId ? '#1a73e8' : '#5f6368')} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Importante" accessibilityState={{ selected: starred }} onPress={() => setStarred((current) => !current)} style={[styles.tool, starred && styles.toolActive]}>
                  <MaterialIcons name={starred ? 'star' : 'star-border'} size={22} color={color(starred ? '#1a73e8' : '#5f6368')} />
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Guardar" onPress={finish} style={[styles.save, !title.trim() && styles.saveDisabled]} disabled={!title.trim()}>
                <Text style={styles.saveText}>Guardar</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
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
      {listPickerOpen && (
        <Modal transparent visible animationType="fade" onRequestClose={() => { setListPickerOpen(false); focusTitle(); }}>
          <View style={styles.listOverlay}>
            <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => { setListPickerOpen(false); focusTitle(); }} />
            <View style={styles.listSheet} accessibilityViewIsModal>
              <Text accessibilityRole="header" style={styles.listTitle}>Elegir lista</Text>
              {lists.length === 0 ? (
                <Text style={styles.listEmpty}>Todavía no tienes listas. Créalas desde Tareas.</Text>
              ) : (
                <ScrollView style={styles.listScroll} bounces={false} keyboardShouldPersistTaps="handled">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ninguna"
                    accessibilityState={{ selected: listId === null }}
                    onPress={() => pickList(null)}
                    style={[styles.listOption, listId === null && styles.listOptionSelected]}
                  >
                    <Text style={[styles.listOptionText, listId === null && styles.listOptionTextSelected]}>Ninguna</Text>
                    {listId === null ? <MaterialIcons name="check" size={20} color={color('#1a73e8')} /> : null}
                  </Pressable>
                  {lists.map((list) => {
                    const selected = listId === list.id;
                    return (
                      <Pressable
                        key={list.id}
                        accessibilityRole="button"
                        accessibilityLabel={list.name}
                        accessibilityState={{ selected }}
                        onPress={() => pickList(list.id)}
                        style={[styles.listOption, selected && styles.listOptionSelected]}
                      >
                        <Text numberOfLines={1} style={[styles.listOptionText, selected && styles.listOptionTextSelected]}>{list.name}</Text>
                        {selected ? <MaterialIcons name="check" size={20} color={color('#1a73e8')} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: color('#20212466'), justifyContent: 'flex-end' },
  sheet: { width: '100%', backgroundColor: color('#fff'), borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 4, gap: 10, overflow: 'hidden', boxShadow: '0px -4px 30px rgba(32,33,36,0.08)' },
  handleHit: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginBottom: 2 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: color('#dadce0') },
  titleRow: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkTarget: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 22, height: 22, borderWidth: 1.7, borderColor: color('#a8b1be'), borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: color('#fff') },
  checkboxDone: { backgroundColor: color('#1a73e8'), borderColor: color('#1a73e8') },
  title: { flex: 1, minWidth: 0, fontFamily: 'Manrope-Medium', fontSize: 20, lineHeight: 28, color: color('#202124'), paddingVertical: 6, paddingHorizontal: 2, minHeight: 40 },
  titleCompleted: { color: color('#8b919b'), textDecorationLine: 'line-through' },
  description: { fontFamily: 'Manrope-Regular', fontSize: 15, lineHeight: 22, color: color('#5f6368'), minHeight: 72, maxHeight: 140, paddingHorizontal: 2, paddingVertical: 4 },
  descriptionExpanded: { flex: 1, minHeight: 160, maxHeight: 10000, fontSize: 16, lineHeight: 24 },
  scheduleHint: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  scheduleHintText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#1a73e8') },
  toolbar: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 4 },
  tools: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tool: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolActive: { backgroundColor: color('#e8f0fe') },
  save: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16, backgroundColor: color('#1a73e8') },
  saveDisabled: { opacity: 0.4 },
  saveText: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: '#fff' },
  listOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.35)' },
  listSheet: { width: '100%', maxWidth: 420, maxHeight: '70%', padding: 18, gap: 6, borderRadius: 20, backgroundColor: color('#fff') },
  listTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 20, color: color('#202124'), marginBottom: 4 },
  listEmpty: { fontFamily: 'Manrope-Regular', fontSize: 14, lineHeight: 21, color: color('#5f6368'), paddingVertical: 8 },
  listScroll: { flexGrow: 0 },
  listOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12 },
  listOptionSelected: { backgroundColor: color('#e8f0fe') },
  listOptionText: { flex: 1, minWidth: 0, fontFamily: 'Manrope-Medium', fontSize: 16, color: color('#202124') },
  listOptionTextSelected: { color: color('#1a73e8') },
});
