import { useAppearance } from '@/theme/appearance';
import { StyleSheet, View } from 'react-native';
import type { DateFieldProps } from './date-field';

const inputStyle = {
  border: '1px solid #dce4ef', borderRadius: 12, padding: '12px 14px',
  color: '#185abc', background: '#f0f5ff', fontFamily: 'Manrope-Medium', fontSize: 14,
  minWidth: 0, flex: 1, outlineColor: '#1a73e8', colorScheme: 'light',
} as const;

export default function DateField({ value, hasTime, onChange }: DateFieldProps) {
  const { preferences, surface, text, border } = useAppearance();
  const themedInput = { ...inputStyle, color: text, background: surface, border: `1px solid ${border}`, outlineColor: preferences.tasks, colorScheme: preferences.dark ? 'dark' : 'light' };
  const localDate = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const localTime = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  return <View style={styles.row}>
    <input aria-label="Elegir fecha" type="date" value={localDate} style={themedInput} onChange={(event) => {
      if (!event.target.value) return;
      const [year, month, day] = event.target.value.split('-').map(Number);
      const next = new Date(value); next.setFullYear(year, month - 1, day); onChange(next);
    }} />
    {hasTime && <input aria-label="Elegir hora" type="time" value={localTime} style={themedInput} onChange={(event) => {
      if (!event.target.value) return;
      const [hours, minutes] = event.target.value.split(':').map(Number);
      const next = new Date(value); next.setHours(hours, minutes, 0, 0); onChange(next);
    }} />}
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8, flexWrap: 'nowrap' } });
