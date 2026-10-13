import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';

export default function TaskListCreate({ onCreate, onClose, initialName }: { initialName?: string; onCreate: (name: string) => void; onClose: () => void }) {
  const { styles, color } = useSectionStyles(makeStyles, 'tasks');
  const [name, setName] = useState(initialName ?? '');
  const input = useRef<TextInput>(null);
  const submitting = useRef(false);
  const create = () => { if (name.trim() && name.trim().length <= 16 && !submitting.current) { submitting.current = true; onCreate(name.trim()); } };
  return <Modal transparent visible animationType="fade" onRequestClose={onClose} onShow={() => input.current?.focus()}>
    <KeyboardAvoidingView style={styles.overlay} enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable feedback={false} style={StyleSheet.absoluteFill} accessibilityLabel="Cancelar edición de lista" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{initialName !== undefined ? 'Renombrar lista' : 'Nueva lista'}</Text>
        <TextInput ref={input} value={name} onChangeText={setName} placeholder="Nombre de la lista" placeholderTextColor={color('#80868b')} accessibilityLabel="Nombre de la lista" maxLength={16} style={styles.input} returnKeyType="done" onSubmitEditing={create} />
        <Text style={styles.limit}>{name.length}/16 caracteres</Text>
        <View style={styles.actions}>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.button}><Text style={styles.cancel}>Cancelar</Text></Pressable>
          <Pressable onPress={create} accessibilityRole="button" disabled={!name.trim() || name.trim().length > 16} style={[styles.button, styles.create, (!name.trim() || name.trim().length > 16) && { opacity: 0.4 }]}><Text style={styles.createText}>{initialName !== undefined ? 'Guardar' : 'Crear lista'}</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.35)' }, sheet: { width: '100%', maxWidth: 500, padding: 24, gap: 20, borderRadius: 24, backgroundColor: color('#fff') },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 22, fontWeight: 'normal', color: color('#202124') }, input: { fontFamily: 'Manrope-Regular', fontSize: 18, padding: 12, borderRadius: 12, backgroundColor: color('#f3f6f4'), color: color('#202124') },
  limit: { fontFamily: 'Manrope-Regular', fontSize: 12, color: color('#80868b'), textAlign: 'right' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }, button: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 }, cancel: { color: color('#5f6368'), fontFamily: 'Manrope-Regular', fontSize: 14 }, create: { backgroundColor: color('#1a73e8') }, createText: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 14, fontWeight: 'normal' },
});
