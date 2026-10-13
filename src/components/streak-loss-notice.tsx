import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useData } from '@/data/data-provider';
import { dayKey, habitStreak, lostHabitStreak, type Habit } from '@/models/habit';
import { useSectionStyles } from '@/theme/appearance';
import HabitHistory from '@/components/habit-history';
import Pressable from '@/components/feedback-pressable';

export default function StreakLossNotice({ owner, previewHabit }: { owner: string; previewHabit?: Habit }) {
  const { habits, ready } = useData();
  const { styles } = useSectionStyles(makeStyles, 'habits');
  const [today, setToday] = useState(dayKey());
  const [seen, setSeen] = useState<string[] | null>(null);
  const [previewClosed, setPreviewClosed] = useState(false);
  const preview = __DEV__ ? previewHabit : undefined;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const storageKey = `mejordia.streak-notices.${owner}.v1`;
  useEffect(() => {
    if (preview) return;
    let active = true;
    AsyncStorage.getItem(storageKey).then((raw) => {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (active && Array.isArray(parsed) && parsed.every((key) => typeof key === 'string')) setSeen(parsed);
    }).catch(() => {});
    return () => { active = false; };
  }, [storageKey, preview]);
  useEffect(() => {
    const refresh = () => setToday(dayKey());
    const timer = setInterval(refresh, 30000);
    const listener = AppState.addEventListener('change', refresh);
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  const habit = preview ? (previewClosed ? undefined : preview) : ready && seen ? habits.find((item) => {
    const key = lostHabitStreak(item, today);
    return key && !seen.includes(key);
  }) : undefined;
  async function dismiss(item: Habit) {
    if (preview) { setPreviewClosed(true); return; }
    if (saving || !seen) return;
    const key = lostHabitStreak(item, today);
    if (!key) return;
    const next = [...seen, key];
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setSeen(next);
      setError(false);
    } catch { setError(true); }
    finally { setSaving(false); }
  }
  if (!habit) return null;
  const last = [...habit.completedDays].filter((day) => day <= today).sort().at(-1)!;
  const count = new Set(habit.completedDays.filter((day) => day <= today)).size;
  const streak = habitStreak(habit, last);
  return <Modal transparent visible animationType="fade" onRequestClose={() => void dismiss(habit)}>
    <View style={styles.overlay}>
      <Pressable feedback={false} accessibilityLabel="Cerrar aviso de racha" style={StyleSheet.absoluteFill} onPress={() => void dismiss(habit)} />
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.emoji}>🧊</Text>
          <Text accessibilityRole="header" style={styles.title}>Perdiste tu racha</Text>
          <Text style={styles.name}>{habit.name}</Text>
          <Text style={styles.message}>Tu racha de {streak} {streak === 1 ? 'día terminó' : 'días terminó'}, pero tu progreso sigue aquí. Cada día que cumpliste cuenta. Hoy puedes empezar de nuevo, a tu ritmo.</Text>
          <Text style={styles.total}>{count} {count === 1 ? 'día cumplido' : 'días cumplidos'}. Todo este esfuerzo sigue siendo tuyo.</Text>
          <HabitHistory habit={habit} today={today} expanded completedRange />
          {error && <Text style={styles.message}>No pudimos guardar el aviso. Intenta cerrarlo de nuevo.</Text>}
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void dismiss(habit)} style={styles.button}><Text style={styles.buttonText}>Seguir adelante</Text></Pressable>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { width: '100%', maxWidth: 600, maxHeight: '85%', borderRadius: 24, backgroundColor: color('#fff'), overflow: 'hidden' },
  content: { padding: 24, gap: 16 }, emoji: { fontFamily: 'Manrope-Regular', fontSize: 32, textAlign: 'center' },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 25, fontWeight: 'normal', color: color('#202124'), textAlign: 'center' },
  name: { fontFamily: 'Manrope-SemiBold', fontSize: 18, fontWeight: 'normal', color: color('#188038'), textAlign: 'center' },
  message: { fontFamily: 'Manrope-Regular', fontSize: 15, lineHeight: 23, color: color('#5f6368') }, total: { fontFamily: 'Manrope-SemiBold', fontSize: 15, lineHeight: 22, fontWeight: 'normal', color: color('#202124') },
  button: { padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: color('#188038') }, buttonText: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 16, fontWeight: 'normal' },
});
