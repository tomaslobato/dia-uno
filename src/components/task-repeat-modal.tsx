import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calendarMonthDays } from '@/models/agenda';
import { dayKey, localDay } from '@/models/habit';
import type { TaskRepeatUnit } from '@/models/task';

const WEEKDAYS = [
  { key: 1, label: 'L' },
  { key: 2, label: 'M' },
  { key: 3, label: 'X' },
  { key: 4, label: 'J' },
  { key: 5, label: 'V' },
  { key: 6, label: 'S' },
  { key: 0, label: 'D' },
] as const;

export type RepeatDraft = {
  every: number;
  unit: TaskRepeatUnit;
  weekdays: number[];
  time: Date | null;
  endsAt: Date | null;
};

type Props = {
  initial: RepeatDraft;
  onDone: (draft: RepeatDraft) => void;
  onClose: () => void;
};

export default function TaskRepeatModal({ initial, onDone, onClose }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  const insets = useSafeAreaInsets();
  const [every, setEvery] = useState(String(initial.every));
  const [unit, setUnit] = useState<TaskRepeatUnit>(initial.unit);
  const [weekdays, setWeekdays] = useState<number[]>(initial.weekdays.length ? initial.weekdays : [initial.time?.getDay() ?? new Date().getDay()]);
  const [time, setTime] = useState<Date | null>(initial.time);
  const [endsAt, setEndsAt] = useState<Date | null>(initial.endsAt);
  const [month, setMonth] = useState(() => {
    const base = initial.endsAt ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1, 12);
  });
  const monthYear = month.getFullYear();
  const monthIndex = month.getMonth();
  const weeks = useMemo(() => calendarMonthDays(new Date(monthYear, monthIndex, 1, 12)), [monthYear, monthIndex]);
  const monthLabel = month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const endsKey = endsAt ? dayKey(endsAt) : null;

  function toggleWeekday(day: number) {
    setWeekdays((current) => {
      if (current.includes(day)) {
        const next = current.filter((value) => value !== day);
        return next.length ? next : current;
      }
      return [...current, day].sort((a, b) => a - b);
    });
  }

  function confirm() {
    const value = Math.max(1, Math.min(99, Number.parseInt(every, 10) || 1));
    onDone({ every: value, unit, weekdays: unit === 'weeks' ? weekdays : [], time, endsAt });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar repetición" onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Se repite</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={confirm} style={styles.done}><Text style={styles.doneText}>Listo</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={styles.label}>Se repite cada</Text>
            <View style={styles.row}>
              <TextInput
                value={every}
                onChangeText={(value) => setEvery(value.replace(/[^0-9]/g, '').slice(0, 2))}
                onBlur={() => setEvery(String(Math.max(1, Math.min(99, Number.parseInt(every, 10) || 1))))}
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={2}
                accessibilityLabel="Cantidad de repetición"
                style={styles.numberInput}
              />
              <View style={styles.units}>
                {([
                  { value: 'days', label: 'día' },
                  { value: 'weeks', label: 'semana' },
                  { value: 'months', label: 'mes' },
                  { value: 'years', label: 'año' },
                ] as const).map((option) => (
                  <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: unit === option.value }} onPress={() => setUnit(option.value)} style={[styles.unit, unit === option.value && styles.unitSelected]}>
                    <Text style={[styles.unitText, unit === option.value && styles.unitTextSelected]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {unit === 'weeks' && <>
              <Text style={styles.label}>Días de la semana</Text>
              <View style={styles.weekdays}>
                {WEEKDAYS.map((day) => {
                  const active = weekdays.includes(day.key);
                  return <Pressable key={day.key} accessibilityRole="checkbox" accessibilityState={{ checked: active }} accessibilityLabel={day.label} onPress={() => toggleWeekday(day.key)} style={[styles.weekday, active && styles.weekdaySelected]}><Text style={[styles.weekdayText, active && styles.weekdayTextSelected]}>{day.label}</Text></Pressable>;
                })}
              </View>
            </>}

            <Text style={styles.label}>Hora de la repetición</Text>
            <View style={styles.timeRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Sin hora de repetición" onPress={() => setTime(null)} style={[styles.chip, !time && styles.chipSelected]}>
                <Text style={[styles.chipText, !time && styles.chipTextSelected]}>Sin hora</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Elegir hora de repetición" onPress={() => {
                const next = time ? new Date(time) : new Date();
                if (!time) next.setHours(9, 0, 0, 0);
                setTime(next);
              }} style={[styles.chip, time && styles.chipSelected]}>
                <MaterialIcons name="schedule" size={16} color={color(time ? '#1a73e8' : '#5f6368')} />
                <Text style={[styles.chipText, time && styles.chipTextSelected]}>{time ? time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Elegir hora'}</Text>
              </Pressable>
            </View>
            {time && <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="Menos una hora" onPress={() => setTime((current) => { const next = new Date(current ?? new Date()); next.setHours(next.getHours() - 1); return next; })} style={styles.stepperButton}><MaterialIcons name="remove" size={18} color={color('#5f6368')} /></Pressable>
              <Text style={styles.timeValue}>{time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Más una hora" onPress={() => setTime((current) => { const next = new Date(current ?? new Date()); next.setHours(next.getHours() + 1); return next; })} style={styles.stepperButton}><MaterialIcons name="add" size={18} color={color('#5f6368')} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Menos 15 minutos" onPress={() => setTime((current) => { const next = new Date(current ?? new Date()); next.setMinutes(next.getMinutes() - 15); return next; })} style={styles.stepperButton}><Text style={styles.minuteLabel}>-15</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Más 15 minutos" onPress={() => setTime((current) => { const next = new Date(current ?? new Date()); next.setMinutes(next.getMinutes() + 15); return next; })} style={styles.stepperButton}><Text style={styles.minuteLabel}>+15</Text></Pressable>
            </View>}

            <Text style={styles.label}>Termina el</Text>
            <View style={styles.timeRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Sin fecha de fin" onPress={() => setEndsAt(null)} style={[styles.chip, !endsAt && styles.chipSelected]}>
                <Text style={[styles.chipText, !endsAt && styles.chipTextSelected]}>Nunca</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Elegir fecha de fin" onPress={() => {
                const next = endsAt ?? new Date();
                if (!endsAt) next.setMonth(next.getMonth() + 1);
                next.setHours(12, 0, 0, 0);
                setEndsAt(next);
                setMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12));
              }} style={[styles.chip, endsAt && styles.chipSelected]}>
                <MaterialIcons name="event" size={16} color={color(endsAt ? '#1a73e8' : '#5f6368')} />
                <Text style={[styles.chipText, endsAt && styles.chipTextSelected]}>{endsAt ? endsAt.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Elegir día'}</Text>
              </Pressable>
            </View>
            {endsAt && <>
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
                      const selected = endsKey === day;
                      return (
                        <Pressable key={day} accessibilityRole="button" accessibilityLabel={dateValue.toLocaleDateString('es-AR')} onPress={() => {
                          setEndsAt(localDay(day));
                          setMonth(new Date(dateValue.getFullYear(), dateValue.getMonth(), 1, 12));
                        }} style={[styles.dayCell, selected && styles.daySelected]}>
                          <Text style={[styles.dayText, outside && styles.dayOutside, selected && styles.daySelectedText]}>{dateValue.getDate()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: color('#fff'), borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', paddingHorizontal: 20, paddingTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 18, color: color('#202124') },
  done: { paddingHorizontal: 8, paddingVertical: 6 },
  doneText: { fontFamily: 'Manrope-SemiBold', fontSize: 15, color: color('#1a73e8') },
  body: { gap: 12, paddingBottom: 20 },
  label: { fontFamily: 'Manrope-Medium', fontSize: 13, color: color('#80868b') },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numberInput: { width: 52, height: 44, borderWidth: 1, borderColor: color('#e1e5ea'), borderRadius: 12, textAlign: 'center', fontFamily: 'Manrope-SemiBold', fontSize: 18, color: color('#202124') },
  units: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unit: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: color('#e1e5ea') },
  unitSelected: { backgroundColor: color('#e8f0fe'), borderColor: color('#e8f0fe') },
  unitText: { fontFamily: 'Manrope-Medium', fontSize: 13, color: color('#5f6368') },
  unitTextSelected: { color: color('#185abc') },
  weekdays: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  weekday: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color('#e1e5ea') },
  weekdaySelected: { backgroundColor: color('#1a73e8'), borderColor: color('#1a73e8') },
  weekdayText: { fontFamily: 'Manrope-SemiBold', fontSize: 13, color: color('#5f6368') },
  weekdayTextSelected: { color: '#fff' },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: color('#e1e5ea') },
  chipSelected: { backgroundColor: color('#e8f0fe'), borderColor: color('#e8f0fe') },
  chipText: { fontFamily: 'Manrope-Medium', fontSize: 13, color: color('#5f6368') },
  chipTextSelected: { color: color('#185abc') },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color('#f1f4f2') },
  timeValue: { minWidth: 64, textAlign: 'center', fontFamily: 'Manrope-SemiBold', fontSize: 16, color: color('#202124') },
  minuteLabel: { fontFamily: 'Manrope-Medium', fontSize: 12, color: color('#5f6368') },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: color('#202124') },
  weekHeader: { flexDirection: 'row', width: '100%', maxWidth: 360, alignSelf: 'center' },
  weekHeaderText: { flex: 1, textAlign: 'center', fontFamily: 'Manrope-Medium', fontSize: 11, color: color('#80868b') },
  grid: { gap: 2, width: '100%', maxWidth: 360, alignSelf: 'center' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  daySelected: { backgroundColor: color('#1a73e8') },
  dayText: { fontFamily: 'Manrope-Medium', fontSize: 14, color: color('#202124') },
  dayOutside: { color: color('#9aa0a6') },
  daySelectedText: { color: '#fff' },
});
