import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Pressable from '@/components/feedback-pressable';
import { useAuth } from '@/auth/auth-provider';

type Props = { active: boolean };

export default function WeekScrollHint({ active }: Props) {
  const { session } = useAuth();
  const owner = session?.user.id ?? 'guest';
  const storageKey = `diauno.agenda-week-scroll.${owner}.v1`;
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey).then((seen) => {
      if (mounted) {
        setVisible(seen !== 'seen');
        setReady(true);
      }
    }).catch(() => {
      if (mounted) {
        setVisible(true);
        setReady(true);
      }
    });
    return () => { mounted = false; };
  }, [storageKey]);

  function dismiss() {
    if (!visible) return;
    setVisible(false);
    void AsyncStorage.setItem(storageKey, 'seen').catch(() => {});
  }

  if (!active || !ready || !visible) return null;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable
        feedback={false}
        accessibilityRole="button"
        accessibilityLabel="Cerrar indicación de desplazamiento"
        onPress={dismiss}
        style={styles.overlay}
      >
        <View style={styles.card} pointerEvents="none">
          <View style={styles.icons} accessible accessibilityLabel="Deslizar horizontalmente">
            <MaterialIcons name="chevron-left" size={28} color="#fff" />
            <MaterialIcons name="swap-horiz" size={36} color="#fff" />
            <MaterialIcons name="chevron-right" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Desliza hacia los lados</Text>
          <Text style={styles.message}>Así ves todos los días de la semana.</Text>
          <Text style={styles.hint}>Toca para continuar</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 22,
    color: '#fff',
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
  },
  hint: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 10,
  },
});
