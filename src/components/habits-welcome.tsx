import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Pressable from '@/components/feedback-pressable';
import { useSectionStyles } from '@/theme/appearance';

export default function HabitsWelcome({ owner, onCreate }: { owner: string; onCreate: () => void }) {
  const { styles } = useSectionStyles(makeStyles, 'habits');
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const storageKey = `mejordia.habits-welcome.${owner}.v1`;
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then((seen) => {
      if (active) setVisible(seen !== 'seen');
    }).catch(() => { if (active) setVisible(true); });
    return () => { active = false; };
  }, [storageKey]);
  async function close(create = false) {
    if (saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, 'seen');
      setVisible(false);
      setError(false);
      if (create) onCreate();
    } catch { setError(true); }
    finally { setSaving(false); }
  }
  if (!visible || pathname !== '/habitos') return null;
  return <Modal transparent visible animationType="fade" onRequestClose={() => void close()}>
    <View style={styles.overlay}>
      <Pressable feedback={false} accessibilityLabel="Cerrar bienvenida de hábitos" style={StyleSheet.absoluteFill} onPress={() => void close()} />
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.emoji}>🌱</Text>
          <Text accessibilityRole="header" style={styles.title}>Cada día cuenta</Text>
          <View style={styles.section}>
            <Text style={styles.heading}>Tu historial, día a día</Text>
            <View accessible accessibilityLabel="Ejemplo: tres días completados y cuatro sin completar" style={styles.dots}>{[true, true, false, true, false, false, false].map((done, i) => <View key={i} style={[styles.dot, done && styles.done]} />)}</View>
            <Text style={styles.message}>Relleno si cumpliste, vacío si no.</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.heading}>📅 Tú eliges el ritmo</Text>
            <Text style={styles.message}>Tú eliges cada cuántos días quieres cumplir el hábito.</Text>
            <View accessible accessibilityLabel="Ejemplo de frecuencia: cada 1 día" style={styles.stepper}>
              <Text style={styles.message}>Cada</Text>
              <View style={styles.stepButton}><Text style={styles.stepSymbol}>−</Text></View>
              <View style={styles.stepNumber}><Text style={styles.number}>1</Text></View>
              <View style={styles.stepButton}><Text style={styles.stepSymbol}>+</Text></View>
              <Text style={styles.message}>Días</Text>
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.heading}>🔥 Mantén tu racha</Text>
            <Text style={styles.message}>Cumple dentro del plazo para mantener tu racha 🔥, si no lo haces, vuelves a cero 🧊.</Text>
          </View>
          {error && <Text style={styles.message}>No pudimos guardar la bienvenida. Intenta cerrarla de nuevo.</Text>}
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void close(true)} style={styles.button}><Text style={styles.buttonText}>Entendido</Text></Pressable>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { width: '100%', maxWidth: 600, maxHeight: '85%', borderRadius: 24, backgroundColor: color('#fff'), overflow: 'hidden' },
  content: { padding: 24, gap: 22 }, emoji: { fontFamily: 'Manrope-Regular', fontSize: 32, textAlign: 'center' },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 25, fontWeight: 'normal', color: color('#202124'), textAlign: 'center' },
  section: { gap: 12 }, heading: { fontFamily: 'Manrope-SemiBold', fontSize: 17, fontWeight: 'normal', color: color('#202124') },
  message: { fontFamily: 'Manrope-Regular', fontSize: 15, lineHeight: 23, color: color('#5f6368') }, dots: { flexDirection: 'row', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: color('#e6f4ea'), alignItems: 'center', justifyContent: 'center' },
  stepSymbol: { fontFamily: 'Manrope-Regular', fontSize: 23, lineHeight: 28, color: color('#188038') },
  stepNumber: { width: 40, height: 36, borderRadius: 10, backgroundColor: color('#f3f6f4'), alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: 'Manrope-Regular', fontSize: 19, color: color('#202124') },
  dot: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: color('#c8d9cd'), backgroundColor: color('#fff') }, done: { backgroundColor: color('#34a853'), borderColor: color('#34a853') },
  button: { padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: color('#188038') }, buttonText: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 16, fontWeight: 'normal' },
});
