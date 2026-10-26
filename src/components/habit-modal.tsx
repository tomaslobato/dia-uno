import Pressable from '@/components/feedback-pressable';
import HabitHistory from '@/components/habit-history';
import HabitIconPicker from '@/components/habit-icon-picker';
import HabitStreak from '@/components/habit-streak';
import HabitSymbolView from '@/components/habit-symbol';
import { pickTime, timePickerAnchorFromEvent } from '@/components/pick-time';
import { HABIT_COLORS } from '@/constants/habit-colors';
import { DEFAULT_HABIT_ICON, HABIT_ICON_CATEGORIES } from '@/constants/habit-icons';
import {
  dateToReminderTime,
  habitGoalLabel,
  localDay,
  previousDay,
  reminderTimeToDate,
  type Habit,
  type HabitDraft,
  type HabitGoalPeriod,
  type HabitSymbol,
} from '@/models/habit';
import { ensureNotificationPermission } from '@/notifications/habit-reminders';
import { accentTextColor, useAppearance } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const nativeDriver = Platform.OS !== 'web';

/** Fade + soft scale for nested confirmation / info popups. */
function QuickPopup({
  visible,
  onClose,
  overlayStyle,
  cardStyle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  overlayStyle: StyleProp<ViewStyle>;
  cardStyle: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.94));

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    scale.setValue(0.94);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
      Animated.spring(scale, { toValue: 1, speed: 26, bounciness: 5, useNativeDriver: nativeDriver }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [visible, opacity, scale]);

  if (!visible) return null;
  return (
    <Animated.View style={[overlayStyle, { opacity }]}>
      <Pressable feedback={false} accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[cardStyle, { transform: [{ scale }] }]} accessibilityViewIsModal>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

type Props = {
  habit?: Habit;
  today: string;
  onClose: () => void;
  onSave: (draft: HabitDraft) => void;
  onToggle?: (day: string) => void;
  onDelete?: () => void;
};

const backdropIcons = HABIT_ICON_CATEGORIES[0].icons.slice(0, 48).map((icon) => icon.name);

export default function HabitModal({ habit, today, onClose, onSave, onToggle, onDelete }: Props) {
  const { preferences } = useAppearance();
  const dark = preferences.dark;
  const sectionAccent = accentTextColor(preferences.habits, dark);
  const insets = useSafeAreaInsets();
  const sheetTop = Math.max(insets.top, 8) + 6;
  const nameInput = useRef<TextInput>(null);
  const deleting = useRef(false);
  const closing = useRef(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [name, setName] = useState(habit?.name ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [symbol, setSymbol] = useState<HabitSymbol>(habit?.symbol ?? { type: 'icon', name: DEFAULT_HABIT_ICON });
  const [color, setColor] = useState(habit?.color ?? HABIT_COLORS[0]);
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(habit?.reminderTime));
  const [reminderTime, setReminderTime] = useState(habit?.reminderTime ?? '09:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [goalEnabled, setGoalEnabled] = useState(Boolean(habit?.goal) || Boolean(habit?.streakEnabled));
  const [goalCountText, setGoalCountText] = useState(String(habit?.goal?.count ?? 1));
  const [goalPeriod, setGoalPeriod] = useState<HabitGoalPeriod>(habit?.goal?.period ?? 'day');
  const [streakInfoOpen, setStreakInfoOpen] = useState(false);

  const styles = useMemo(() => makeStyles(dark, color), [dark, color]);
  const parsedGoalCount = Number(goalCountText);
  const goalCount = Number.isSafeInteger(parsedGoalCount) && parsedGoalCount >= 1 ? Math.min(parsedGoalCount, 999) : 1;

  const focusName = useCallback(() => {
    if (habit) return;
    const run = () => nameInput.current?.focus();
    requestAnimationFrame(() => {
      run();
      setTimeout(run, Platform.OS === 'android' ? 280 : 80);
      setTimeout(run, Platform.OS === 'android' ? 500 : 160);
    });
  }, [habit]);

  async function enableReminder(next: boolean) {
    if (!next) {
      setReminderEnabled(false);
      return;
    }
    const allowed = await ensureNotificationPermission();
    if (!allowed && Platform.OS !== 'web') {
      // Still allow configuring the time locally; scheduling will no-op without permission.
    }
    setReminderEnabled(true);
  }

  function openTimePicker(event?: { nativeEvent?: { clientX?: number; clientY?: number; pageX?: number; pageY?: number } }) {
    const value = reminderTimeToDate(reminderTime);
    const needsInline = pickTime(value, (selected) => {
      setReminderTime(dateToReminderTime(selected));
      setReminderEnabled(true);
    }, timePickerAnchorFromEvent(event));
    if (needsInline) setShowTimePicker(true);
  }

  function discard() {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    onClose();
  }

  function finish() {
    if (closing.current) return;
    if (!name.trim()) {
      nameInput.current?.focus();
      return;
    }
    onSave({
      name,
      description,
      symbol,
      color,
      kind: 'build',
      reminderTime: reminderEnabled ? reminderTime : null,
      goal: goalEnabled ? { count: goalCount, period: goalPeriod } : null,
      streakEnabled: goalEnabled,
      intervalDays: habit?.intervalDays ?? 1,
    });
    closing.current = true;
    Keyboard.dismiss();
    onClose();
  }

  function setMeta(enabled: boolean) {
    if (enabled && !goalEnabled) setStreakInfoOpen(true);
    setGoalEnabled(enabled);
  }

  function requestClose() {
    if (confirmDelete) { setConfirmDelete(false); return; }
    if (streakInfoOpen) { setStreakInfoOpen(false); return; }
    if (pickerOpen) { setPickerOpen(false); return; }
    discard();
  }

  return (
    <Modal transparent animationType="slide" visible statusBarTranslucent onRequestClose={requestClose} onShow={focusName}>
      <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar" onPress={discard} />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              marginTop: sheetTop,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
            <View style={styles.handle} />
            <View style={styles.top}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={discard} style={styles.roundButton}>
                <MaterialIcons name="close" size={22} color={styles.mutedIcon.color} />
              </Pressable>
              <Text style={styles.heading}>{habit ? 'Editar hábito' : 'Nuevo hábito'}</Text>
              {habit && onDelete ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Eliminar hábito" onPress={() => { Keyboard.dismiss(); setConfirmDelete(true); }} style={styles.roundButton}>
                  <MaterialIcons name="delete-outline" size={22} color="#b3261e" />
                </Pressable>
              ) : <View style={styles.roundButtonSpacer} />}
            </View>

            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {habit ? (
                <View style={styles.historyBlock}>
                  <View style={styles.summaryRow}>
                    <View style={[styles.summaryIcon, { backgroundColor: `${color}28` }]}>
                      <HabitSymbolView symbol={symbol} color={color} size={26} />
                    </View>
                    <View style={styles.summaryText}>
                      <Text style={[styles.summaryName, { color }]} numberOfLines={1}>{habit.name}</Text>
                      {habit.description ? <Text style={styles.summaryDescription} numberOfLines={2}>{habit.description}</Text> : null}
                    </View>
                    {goalEnabled ? <HabitStreak habit={{ ...habit, streakEnabled: true }} today={today} /> : null}
                  </View>
                  <Text style={styles.label}>COMPLETAR</Text>
                  <View style={styles.actions}>
                    {[{ label: 'Hoy', day: today }, { label: 'Ayer', day: previousDay(localDay(today)) }].map(({ label, day }) => {
                      const checked = habit.completedDays.includes(day);
                      return (
                        <Pressable
                          key={day}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Completar ${label.toLowerCase()}`}
                          aria-checked={checked}
                          accessibilityState={{ checked }}
                          onPress={() => onToggle?.(day)}
                          style={[styles.dayButton, checked && { backgroundColor: `${color}33` }]}
                        >
                          <MaterialIcons name={checked ? 'check' : 'add'} size={22} color={color} />
                          <Text style={[styles.dayLabel, { color }]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.label}>HISTORIAL</Text>
                  <HabitHistory habit={habit} today={today} expanded />
                  <Text style={styles.editSection}>EDITAR HÁBITO</Text>
                </View>
              ) : null}

              <View style={styles.iconHero}>
                <View style={styles.iconBackdrop} pointerEvents="none">
                  {backdropIcons.map((name, index) => (
                    <MaterialIcons key={`${name}-${index}`} name={name as ComponentProps<typeof MaterialIcons>['name']} size={18} color={dark ? '#2a2a2a' : '#e6e8eb'} style={styles.backdropIcon} />
                  ))}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Cambiar icono" onPress={() => setPickerOpen(true)} style={styles.iconButton}>
                  <View style={[styles.iconCircle, { backgroundColor: `${color}33`, borderColor: color }]}>
                    <HabitSymbolView symbol={symbol} color={color} size={42} />
                  </View>
                  <View style={[styles.editBadge, { backgroundColor: color }]}>
                    <MaterialIcons name="edit" size={14} color="#fff" />
                  </View>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setPickerOpen(true)}>
                  <Text style={[styles.changeIcon, { color }]}>Cambiar icono</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>NOMBRE</Text>
              <TextInput
                ref={nameInput}
                accessibilityLabel="Nombre del hábito"
                placeholder="Nombre del hábito"
                placeholderTextColor={dark ? '#6b7280' : '#9aa0a6'}
                value={name}
                onChangeText={setName}
                style={styles.input}
                maxLength={120}
              />

              <Text style={styles.label}>DESCRIPCIÓN</Text>
              <TextInput
                accessibilityLabel="Descripción del hábito"
                placeholder="Añadir una descripción"
                placeholderTextColor={dark ? '#6b7280' : '#9aa0a6'}
                value={description}
                onChangeText={setDescription}
                style={[styles.input, styles.description]}
                multiline
                maxLength={4000}
                textAlignVertical="top"
              />

              <Text style={styles.label}>COLOR</Text>
              <View style={styles.colorGrid}>
                {HABIT_COLORS.map((swatch) => {
                  const active = color === swatch;
                  return (
                    <Pressable
                      key={swatch}
                      accessibilityRole="button"
                      accessibilityLabel={`Color ${swatch}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => setColor(swatch)}
                      style={[styles.colorSwatchWrap, active && { borderColor: swatch }]}
                    >
                      <View style={[styles.colorSwatch, { backgroundColor: swatch }]} />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>RECORDATORIO</Text>
              <View style={styles.segment}>
                {([
                  { id: false, label: 'Sin aviso' },
                  { id: true, label: 'A cierta hora' },
                ] as const).map((option) => {
                  const active = reminderEnabled === option.id;
                  return (
                    <Pressable
                      key={String(option.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => { void enableReminder(option.id); }}
                      style={[styles.segmentButton, active && styles.segmentButtonActive]}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {reminderEnabled && (
                <Pressable accessibilityRole="button" accessibilityLabel="Elegir hora del recordatorio" onPress={(event) => openTimePicker(event)} style={styles.timeButton}>
                  <MaterialIcons name="schedule" size={20} color={color} />
                  <Text style={[styles.timeText, { color }]}>{reminderTime}</Text>
                </Pressable>
              )}
              {showTimePicker && Platform.OS === 'ios' && (
                <DateTimePicker
                  value={reminderTimeToDate(reminderTime)}
                  mode="time"
                  display="spinner"
                  locale="es-AR"
                  themeVariant={dark ? 'dark' : 'light'}
                  is24Hour
                  onValueChange={(_, selected) => {
                    if (!selected) return;
                    setReminderTime(dateToReminderTime(selected));
                  }}
                />
              )}
              {showTimePicker && Platform.OS === 'ios' && (
                <Pressable onPress={() => setShowTimePicker(false)} style={styles.timeDone}>
                  <Text style={[styles.timeDoneText, { color }]}>Listo</Text>
                </Pressable>
              )}

              <Text style={styles.label}>META Y RACHA</Text>
              <View style={styles.segment}>
                {([
                  { id: false, label: 'Sin meta' },
                  { id: true, label: 'Con meta' },
                ] as const).map((option) => {
                  const active = goalEnabled === option.id;
                  return (
                    <Pressable
                      key={String(option.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setMeta(option.id)}
                      style={[styles.segmentButton, active && styles.segmentButtonActive]}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {goalEnabled && (
                <View style={styles.goalControls}>
                  <Text style={styles.helper}>{habitGoalLabel({ count: goalCount, period: goalPeriod })}</Text>
                  <View style={styles.stepper}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Reducir meta" disabled={goalCount <= 1} onPress={() => setGoalCountText(String(goalCount - 1))} style={[styles.stepButton, goalCount <= 1 && styles.disabled]}>
                      <MaterialIcons name="remove" size={22} color={color} />
                    </Pressable>
                    <TextInput
                      accessibilityLabel="Cantidad de la meta"
                      inputMode="numeric"
                      keyboardType="number-pad"
                      value={goalCountText}
                      onChangeText={(value) => { if (/^\d*$/.test(value)) setGoalCountText(value); }}
                      onBlur={() => setGoalCountText(String(goalCount))}
                      selectTextOnFocus
                      style={styles.numberInput}
                    />
                    <Pressable accessibilityRole="button" accessibilityLabel="Aumentar meta" onPress={() => setGoalCountText(String(Math.min(goalCount + 1, 999)))} style={styles.stepButton}>
                      <MaterialIcons name="add" size={22} color={color} />
                    </Pressable>
                  </View>
                  <View style={styles.periodRow}>
                    {([
                      { id: 'day' as const, label: 'Día' },
                      { id: 'week' as const, label: 'Semana' },
                      { id: 'month' as const, label: 'Mes' },
                    ]).map((option) => {
                      const active = goalPeriod === option.id;
                      return (
                        <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setGoalPeriod(option.id)} style={[styles.periodChip, active && { backgroundColor: `${color}33`, borderColor: color }]}>
                          <Text style={[styles.periodText, active && { color }]}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            <Pressable accessibilityRole="button" accessibilityLabel="Guardar hábito" disabled={!name.trim()} onPress={finish} style={[styles.save, { backgroundColor: sectionAccent }, !name.trim() && styles.saveDisabled]}>
              <Text style={styles.saveText}>Guardar</Text>
            </Pressable>

            <QuickPopup visible={streakInfoOpen} onClose={() => setStreakInfoOpen(false)} overlayStyle={styles.infoOverlay} cardStyle={styles.infoCard}>
              <View style={[styles.infoIcon, { backgroundColor: `${color}22` }]}>
                <Text style={styles.infoEmoji}>🔥</Text>
              </View>
              <Text accessibilityRole="header" style={styles.infoTitle}>Tu racha</Text>
              <Text style={styles.infoMessage}>
                La meta y la racha van juntas. La racha suma cada día mientras todavía puedas cumplir tu meta en el período. Si ya no da el tiempo (por ejemplo, te faltan 4 días y solo quedan 2), la racha se pierde.
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setStreakInfoOpen(false)} style={[styles.infoButton, { backgroundColor: color }]}>
                <Text style={styles.infoButtonText}>Entendido</Text>
              </Pressable>
            </QuickPopup>

            <QuickPopup visible={confirmDelete} onClose={() => setConfirmDelete(false)} overlayStyle={styles.infoOverlay} cardStyle={[styles.infoCard, styles.confirmationCard]}>
              <Text accessibilityRole="header" style={[styles.infoTitle, styles.confirmationTitleAlign]}>¿Eliminar hábito?</Text>
              <Text style={[styles.infoMessage, styles.confirmationMessageAlign]}>Se eliminará “{habit?.name}” junto con todo su historial. Esta acción no se puede deshacer.</Text>
              <View style={styles.confirmationActions}>
                <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(false)} style={styles.confirmationButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => { if (deleting.current) return; deleting.current = true; onDelete?.(); onClose(); }} style={styles.confirmationButton}><Text style={styles.deleteText}>Eliminar</Text></Pressable>
              </View>
            </QuickPopup>
        </View>
      </KeyboardAvoidingView>
      {pickerOpen && <HabitIconPicker selected={symbol} accent={color} onSelect={setSymbol} onClose={() => setPickerOpen(false)} />}
    </Modal>
  );
}

function makeStyles(dark: boolean, _accent: string) {
  const bg = dark ? '#000000' : '#f8fafd';
  const card = dark ? '#1A1A1A' : '#ffffff';
  const input = dark ? '#1E1E1E' : '#f1f3f5';
  const text = dark ? '#EDF0F5' : '#202124';
  const muted = dark ? '#9aa0a6' : '#80868b';
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: dark ? 'rgba(0,0,0,0.72)' : 'rgba(32,33,36,0.35)' },
    sheet: {
      flex: 1,
      width: '100%',
      maxWidth: 660,
      alignSelf: 'center',
      backgroundColor: bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      overflow: 'hidden',
    },
    handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: dark ? '#3a3a3a' : '#dadce0', marginBottom: 8 },
    top: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 4 },
    heading: { fontFamily: 'Manrope-SemiBold', fontSize: 18, color: text },
    roundButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: card, alignItems: 'center', justifyContent: 'center' },
    roundButtonSpacer: { width: 40, height: 40 },
    mutedIcon: { color: muted },
    scroll: { flex: 1, minHeight: 0 },
    content: { paddingHorizontal: 24, paddingBottom: 28, gap: 10, flexGrow: 1 },
    iconHero: { alignItems: 'center', paddingVertical: 18, marginBottom: 8 },
    iconBackdrop: { ...StyleSheet.absoluteFill, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', opacity: 0.55, paddingHorizontal: 8, gap: 14 },
    backdropIcon: { margin: 2 },
    iconButton: { alignItems: 'center', justifyContent: 'center' },
    iconCircle: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: card },
    editBadge: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: bg },
    changeIcon: { marginTop: 14, fontFamily: 'Manrope-SemiBold', fontSize: 15 },
    label: { fontFamily: 'Manrope-Medium', fontSize: 12, letterSpacing: 1.1, color: muted, marginTop: 10 },
    input: { fontFamily: 'Manrope-Regular', fontSize: 16, color: text, backgroundColor: input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
    description: { minHeight: 88, maxHeight: 140 },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    colorSwatchWrap: { width: 40, height: 40, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    colorSwatch: { width: 32, height: 32, borderRadius: 10 },
    segment: { flexDirection: 'row', gap: 8, backgroundColor: input, borderRadius: 14, padding: 4 },
    segmentButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    segmentButtonActive: { backgroundColor: dark ? '#2A2A2A' : '#ffffff' },
    segmentText: { fontFamily: 'Manrope-Medium', fontSize: 13, color: muted, textAlign: 'center' },
    segmentTextActive: { color: text },
    helper: { fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 18, color: muted, marginTop: 2 },
    timeButton: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4 },
    timeText: { fontFamily: 'Manrope-SemiBold', fontSize: 18 },
    timeDone: { alignSelf: 'flex-end', padding: 8 },
    timeDoneText: { fontFamily: 'Manrope-SemiBold', fontSize: 15 },
    goalControls: { gap: 10 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: input, alignItems: 'center', justifyContent: 'center' },
    disabled: { opacity: 0.35 },
    numberInput: { width: 72, paddingVertical: 10, borderRadius: 12, backgroundColor: input, textAlign: 'center', fontFamily: 'Manrope-Regular', fontSize: 22, color: text },
    periodRow: { flexDirection: 'row', gap: 8 },
    periodChip: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: dark ? '#333' : '#e1e5ea', paddingVertical: 12, alignItems: 'center', backgroundColor: input },
    periodText: { fontFamily: 'Manrope-Medium', fontSize: 13, color: muted },
    historyBlock: { gap: 12, marginBottom: 8 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
    summaryIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    summaryText: { flex: 1, gap: 2 },
    summaryName: { fontFamily: 'Manrope-SemiBold', fontSize: 20 },
    summaryDescription: { fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 18, color: muted },
    editSection: { fontFamily: 'Manrope-SemiBold', fontSize: 13, letterSpacing: 1.1, color: text, marginTop: 18, marginBottom: 4 },
    actions: { flexDirection: 'row', gap: 12 },
    dayButton: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: input, flex: 1 },
    dayLabel: { fontFamily: 'Manrope-Medium', fontSize: 15 },
    save: { flexShrink: 0, marginHorizontal: 24, marginTop: 8, borderRadius: 16, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
    saveDisabled: { opacity: 0.45 },
    saveText: { fontFamily: 'Manrope-SemiBold', fontSize: 17, color: '#fff' },
    confirmationCard: { alignItems: 'stretch', maxWidth: 420 },
    confirmationTitleAlign: { textAlign: 'left', alignSelf: 'stretch' },
    confirmationMessageAlign: { textAlign: 'left', alignSelf: 'stretch' },
    confirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, alignSelf: 'stretch', marginTop: 4 },
    confirmationButton: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
    cancelText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: muted },
    deleteText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: '#b3261e' },
    infoOverlay: { ...StyleSheet.absoluteFill, backgroundColor: dark ? 'rgba(0,0,0,0.72)' : 'rgba(32,33,36,0.45)', justifyContent: 'center', paddingHorizontal: 28, zIndex: 20 },
    infoCard: { width: '100%', maxWidth: 360, alignSelf: 'center', backgroundColor: card, borderRadius: 24, padding: 24, gap: 12, alignItems: 'center' },
    infoIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    infoEmoji: { fontSize: 28, lineHeight: 34 },
    infoTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 20, color: text, textAlign: 'center' },
    infoMessage: { fontFamily: 'Manrope-Regular', fontSize: 14, lineHeight: 21, color: muted, textAlign: 'center' },
    infoButton: { marginTop: 8, alignSelf: 'stretch', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    infoButtonText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: '#fff' },
  });
}
