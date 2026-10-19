import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Pressable from '@/components/feedback-pressable';
import TaskListCreate from '@/components/task-list-create';
import { useSectionStyles } from '@/theme/appearance';
import type { TaskList } from '@/models/task-list';

type Props = { list: TaskList; onClose: () => void; onRename: (name: string) => void; onDelete: () => void };
export default function TaskListOptions({ list, onClose, onRename, onDelete }: Props) {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  const [action, setAction] = useState<'options' | 'rename' | 'delete'>('options');
  if (action === 'rename') return <TaskListCreate initialName={list.name} onCreate={onRename} onClose={onClose} />;
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar opciones de lista" onPress={onClose} />
      <View style={styles.sheet} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={styles.title}>{action === 'delete' ? '¿Eliminar lista?' : list.name}</Text>
        {action === 'delete' ? <>
          <Text style={styles.message}>Se eliminará “{list.name}”. Sus tareas se conservarán sin lista y podrás verlas en Todo.</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}><Text style={styles.label}>Cancelar</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Confirmar eliminación de lista" onPress={onDelete} style={styles.button}><Text style={styles.danger}>Eliminar</Text></Pressable>
          </View>
        </> : <>
          <Pressable accessibilityRole="button" accessibilityLabel="Renombrar" onPress={() => setAction('rename')} style={styles.option}><MaterialIcons name="edit" size={21} color={color('#1a73e8')} /><Text style={styles.label}>Renombrar</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Eliminar lista" onPress={() => setAction('delete')} style={styles.option}><MaterialIcons name="delete-outline" size={21} color={color('#b3261e')} /><Text style={styles.danger}>Eliminar</Text></Pressable>
        </>}
      </View>
    </View>
  </Modal>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { width: '100%', maxWidth: 420, padding: 18, gap: 8, borderRadius: 20, backgroundColor: color('#fff') },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 20, color: color('#202124'), marginBottom: 0 },
  message: { fontFamily: 'Manrope-Regular', fontSize: 14, lineHeight: 21, color: color('#5f6368') },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  button: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  label: { fontFamily: 'Manrope-Medium', fontSize: 15, color: color('#1a73e8') },
  danger: { fontFamily: 'Manrope-Medium', fontSize: 15, color: color('#b3261e') },
});
