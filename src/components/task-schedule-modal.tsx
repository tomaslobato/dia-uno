import Pressable from '@/components/feedback-pressable';
import { pickTime, timePickerAnchorFromEvent } from '@/components/pick-time';
import TaskRepeatModal, { type RepeatDraft } from '@/components/task-repeat-modal';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calendarMonthDays } from '@/models/agenda';
import { dayKey, localDay } from '@/models/habit';
import type { TaskRepeatUnit } from '@/models/task';

export type ScheduleDraft = {
  date: Date | null;
  hasTime: boolean;
  repeatEnabled: boolean;
  repeatEvery: number;
  repeatUnit: TaskRepeatUnit;
  repeatWeekdays: number[];
  repeatEndsAt: Date | null;
};

type Props = {
  initial: ScheduleDraft;
  onDone: (draft: ScheduleDraft) => void;
  onClose: () => void;
};

export default function TaskScheduleModal({ initial, onDone, onClose }: Props) {
  const { styles, color, preferences } = useSectionStyles(makeStyles, 'tasks');
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<Date | null>(initial.date);
  const [hasTime, setHasTime] = useState(initial.hasTime);
  const [repeatEnabled, setRepeatEnabled] = useState(initial.repeatEnabled);
  const [repeatEvery, setRepeatEvery] = useState(initial.repeatEvery);
  const [repeatUnit, setRepeatUnit] = useState<TaskRepeatUnit>(initial.repeatUnit);
  const [repeatWeekdays, setRepeatWeekdays] = useState(initial.repeatWeekdays);
  const [repeatEndsAt, setRepeatEndsAt] = useState<Date | null>(initial.repeatEndsAt);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [iosTimeOpen, setIosTimeOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const base = initial.date ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1, 12);
  });
  const monthYear = month.getFullYear();
  const monthIndex = month.getMonth();
  const weeks = useMemo(() => calendarMonthDays(new Date(monthYear, monthIndex, 1, 12)), [monthYear, monthIndex]);
  const monthLabel = month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const todayKey = dayKey();
  const selectedKey = date ? dayKey(date) : null;

  function selectDay(day: string) {
    const picked = localDay(day);
    const next = date ? new Date(date) : new Date(picked);
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    if (!hasTime) next.setHours(12, 0, 0, 0);
    setDate(next);
    setMonth(new Date(picked.getFullYear(), picked.getMonth(), 1, 12));
  }

  function withDefaultTime(base: Date) {
    const next = new Date(base);
    const now = new Date();
    next.setHours(now.getHours() + 1, 0, 0, 0);
    return next;
  }

  function applyPickedTime(selected: Date) {
    const base = date ? new Date(date) : new Date();
    base.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setDate(base);
    setHasTime(true);
  }

  function openTimePicker(event?: { nativeEvent?: { clientX?: number; clientY?: number; pageX?: number; pageY?: number } }) {
    const value = date && hasTime ? date : withDefaultTime(date ?? new Date());
    if (!(date && hasTime)) {
      setDate(value);
      setHasTime(true);
    }
    const showInline = pickTime(value, (selected) => {
      applyPickedTime(selected);
      setIosTimeOpen(false);
    }, timePickerAnchorFromEvent(event));
    if (showInline) setIosTimeOpen(true);
  }

  function clearTime() {
    if (date) {
      const next = new Date(date);
      next.setHours(12, 0, 0, 0);
      setDate(next);
    }
    setHasTime(false);
    setIosTimeOpen(false);
  }

  function confirm() {
    onDone({
      date,
      hasTime: Boolean(date && hasTime),
      repeatEnabled: Boolean(date && repeatEnabled),
      repeatEvery,
      repeatUnit,
      repeatWeekdays,
      repeatEndsAt: date && repeatEnabled ? repeatEndsAt : null,
    });
  }

  function onRepeatDone(draft: RepeatDraft) {
    setRepeatEvery(draft.every);
    setRepeatUnit(draft.unit);
    setRepeatWeekdays(draft.weekdays);
    setRepeatEndsAt(draft.endsAt);
    setRepeatEnabled(true);
    if (draft.time && date) {
      const next = new Date(date);
      next.setHours(draft.time.getHours(), draft.time.getMinutes(), 0, 0);
      setDate(next);
      setHasTime(true);
    }
    setRepeatOpen(false);
    onDone({
      date: draft.time && date ? (() => {
        const next = new Date(date);
        next.setHours(draft.time!.getHours(), draft.time!.getMinutes(), 0, 0);
        return next;
      })() : date,
      hasTime: Boolean((draft.time && date) || (date && hasTime)),
      repeatEnabled: true,
      repeatEvery: draft.every,
      repeatUnit: draft.unit,
      repeatWeekdays: draft.weekdays,
      repeatEndsAt: draft.endsAt,
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar fecha y hora" onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Fecha y hora</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={confirm}><Text style={styles.doneText}>Listo</Text></Pressable>
          </View>

          <View style={styles.monthHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1, 12))} style={styles.monthArrow}><MaterialIcons name="chevron-left" size={24} color={color('#202124')} /></Pressable>
            <Text style={styles.monthTitle}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1, 12))} style={styles.monthArrow}><MaterialIcons name="chevron-right" size={24} color={color('#202124')} /></Pressable>
          </View>
          <View style={styles.weekHeader}>{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label) => <Text key={label} style={styles.weekHeaderText}>{label}</Text>)}</View>
          <View style={styles.grid}>
            {weeks.map((week) => (
              <View key={week[0]} style={styles.weekRow}>
                {week.map((day) => {
                  const dateValue = localDay(day);
                  const outside = dateValue.getMonth() !== monthIndex;
                  const selected = selectedKey === day;
                  const isToday = todayKey === day;
                  return (
                    <Pressable key={day} accessibilityRole="button" accessibilityLabel={dateValue.toLocaleDateString('es-AR')} onPress={() => selectDay(day)} style={[styles.dayCell, selected && styles.daySelected]}>
                      <Text style={[styles.dayText, outside && styles.dayOutside, isToday && !selected && styles.dayToday, selected && styles.daySelectedText]}>{dateValue.getDate()}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Quitar fecha" onPress={() => { setDate(null); setHasTime(false); setRepeatEnabled(false); }} style={styles.row}>
            <MaterialIcons name="event-busy" size={20} color={color('#5f6368')} />
            <Text style={styles.rowText}>Sin fecha</Text>
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityState={{ selected: hasTime }} accessibilityLabel={hasTime && date ? `Cambiar hora, ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}` : 'Añadir hora'} onPress={(event) => openTimePicker(event)} style={styles.row}>
            <MaterialIcons name="schedule" size={20} color={color(hasTime ? '#1a73e8' : '#5f6368')} />
            <Text style={[styles.rowText, hasTime && styles.rowTextActive]}>{hasTime && date ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Añadir hora'}</Text>
            {hasTime && date && (
              <Pressable accessibilityRole="button" accessibilityLabel="Quitar hora" onPress={clearTime} hitSlop={10} style={styles.clearTime}>
                <MaterialIcons name="close" size={24} color={color('#80868b')} />
              </Pressable>
            )}
          </Pressable>
          {Platform.OS === 'ios' && iosTimeOpen && date && (
            <DateTimePicker
              value={date}
              mode="time"
              display="spinner"
              locale="es-AR"
              themeVariant={preferences.dark ? 'dark' : 'light'}
              is24Hour
              onValueChange={(_event, selected) => {
                applyPickedTime(selected);
              }}
            />
          )}

          <Pressable disabled={!date} accessibilityRole="switch" accessibilityState={{ checked: repeatEnabled, disabled: !date }} accessibilityLabel="Repetir" onPress={() => {
            if (!date) return;
            if (repeatEnabled) setRepeatOpen(true);
            else {
              setRepeatEnabled(true);
              setRepeatOpen(true);
            }
          }} style={[styles.row, !date && styles.rowDisabled]}>
            <MaterialIcons name="repeat" size={20} color={color(repeatEnabled ? '#1a73e8' : '#5f6368')} />
            <Text style={[styles.rowText, repeatEnabled && styles.rowTextActive]}>
              {repeatEnabled ? `Cada ${repeatEvery} ${repeatUnit === 'days' ? 'día' : repeatUnit === 'weeks' ? 'semana' : repeatUnit === 'months' ? 'mes' : 'año'}${repeatEvery === 1 ? '' : 's'}` : 'Repetir'}
            </Text>
            {repeatEnabled && <Pressable accessibilityRole="button" accessibilityLabel="Quitar repetición" onPress={() => setRepeatEnabled(false)} hitSlop={8}><MaterialIcons name="close" size={18} color={color('#80868b')} /></Pressable>}
          </Pressable>
        </View>
      </View>
      {repeatOpen && <TaskRepeatModal
        initial={{
          every: repeatEvery,
          unit: repeatUnit,
          weekdays: repeatWeekdays,
          time: hasTime && date ? date : null,
          endsAt: repeatEndsAt,
        }}
        onClose={() => setRepeatOpen(false)}
        onDone={onRepeatDone}
      />}
    </Modal>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  // Cap width so the aspect-ratio day grid stays phone-sized on desktop.
  sheet: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: color('#fff'), borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 18, color: color('#202124') },
  doneText: { fontFamily: 'Manrope-SemiBold', fontSize: 15, color: color('#1a73e8'), padding: 6 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: color('#202124') },
  weekHeader: { flexDirection: 'row', paddingHorizontal: 2, width: '100%', maxWidth: 360, alignSelf: 'center' },
  weekHeaderText: { flex: 1, textAlign: 'center', fontFamily: 'Manrope-Medium', fontSize: 11, color: color('#80868b') },
  grid: { gap: 2, width: '100%', maxWidth: 360, alignSelf: 'center' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  daySelected: { backgroundColor: color('#1a73e8') },
  dayText: { fontFamily: 'Manrope-Medium', fontSize: 14, color: color('#202124') },
  dayOutside: { color: color('#9aa0a6') },
  dayToday: { color: color('#1a73e8'), fontFamily: 'Manrope-SemiBold' },
  daySelectedText: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 12, borderRadius: 14 },
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1, fontFamily: 'Manrope-Medium', fontSize: 15, color: color('#3c4043') },
  rowTextActive: { color: color('#185abc') },
  clearTime: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
});
