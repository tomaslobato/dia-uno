import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export type DateFieldProps = { value: Date; hasTime: boolean; onChange: (value: Date) => void };

export default function DateField({ value, hasTime, onChange }: DateFieldProps) {
  const { styles, color, preferences } = useSectionStyles(makeStyles, 'tasks');
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  function open(nextMode: 'date' | 'time') {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value, mode: nextMode, is24Hour: true,
        onValueChange: (_, selected) => {
          if (!selected) return;
          const next = new Date(value);
          if (nextMode === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
          else next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          onChange(next);
        },
      });
    } else setMode(mode === nextMode ? null : nextMode);
  }
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Elegir fecha" onPress={() => open('date')} style={styles.field}>
          <MaterialIcons name="calendar-today" size={18} color={color('#1a73e8')} />
          <Text style={styles.label}>{value.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </Pressable>
        {hasTime && <Pressable accessibilityRole="button" accessibilityLabel="Elegir hora" onPress={() => open('time')} style={styles.field}>
          <MaterialIcons name="schedule" size={18} color={color('#1a73e8')} />
          <Text style={styles.label}>{value.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
        </Pressable>}
      </View>
      {Platform.OS === 'ios' && mode && <DateTimePicker value={value} mode={mode} display="spinner" locale="es-AR" themeVariant={preferences.dark ? "dark" : "light"} is24Hour onValueChange={(_, selected) => onChange(selected)} />}
    </View>
  );
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  container: { gap: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color('#f0f5ff'), paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12 },
  label: { color: color('#185abc'), fontFamily: 'Manrope-Medium', fontSize: 14, fontWeight: 'normal' },
});
