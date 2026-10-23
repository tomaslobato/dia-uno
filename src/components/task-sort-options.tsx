import { Modal, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';
import type { TaskSortMode } from '@/hooks/use-task-sort';

type Props = { mode: TaskSortMode; onClose: () => void; onSelect: (mode: TaskSortMode) => void };

export default function TaskSortOptions({ mode, onClose, onSelect }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  function choose(next: TaskSortMode) {
    onSelect(next);
    onClose();
  }
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar opciones de orden" onPress={onClose} />
      <View style={styles.sheet} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={styles.title}>Ordenar por</Text>
        <Pressable accessibilityRole="radio" accessibilityLabel="Fecha" accessibilityState={{ checked: mode === 'date' }} aria-checked={mode === 'date'} onPress={() => choose('date')} style={styles.option}>
          <MaterialIcons name="event" size={21} color={color('#1a73e8')} />
          <Text style={styles.label}>Fecha</Text>
          {mode === 'date' ? <MaterialIcons name="check" size={20} color={color('#1a73e8')} /> : <View style={styles.checkSpacer} />}
        </Pressable>
        <Pressable accessibilityRole="radio" accessibilityLabel="Manual" accessibilityState={{ checked: mode === 'manual' }} aria-checked={mode === 'manual'} accessibilityHint="Usá el ícono de arrastre a la derecha de cada tarea" onPress={() => choose('manual')} style={styles.option}>
          <MaterialIcons name="swap-vert" size={21} color={color('#1a73e8')} />
          <Text style={styles.label}>Manual</Text>
          {mode === 'manual' ? <MaterialIcons name="check" size={20} color={color('#1a73e8')} /> : <View style={styles.checkSpacer} />}
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { width: '100%', maxWidth: 360, padding: 18, gap: 4, borderRadius: 20, backgroundColor: color('#fff') },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 18, color: color('#202124'), marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12 },
  label: { flex: 1, fontFamily: 'Manrope-Medium', fontSize: 15, color: color('#202124') },
  checkSpacer: { width: 20, height: 20 },
});
