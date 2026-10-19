import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { finishGoogleSignIn } from '@/auth/auth-provider';
import Pressable from '@/components/feedback-pressable';
import { useAppearance } from '@/theme/appearance';

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const [error, setError] = useState<string | null>(null);
  const { text, muted, preferences } = useAppearance();
  useEffect(() => {
    let active = true;
    const url = Platform.OS === 'web' ? window.location.href : `mejordia://auth/callback?${new URLSearchParams({ ...(params.code ? { code: params.code } : {}), ...(params.error ? { error: params.error } : {}) })}`;
    Promise.resolve().then(() => finishGoogleSignIn(url)).then(() => {
      if (active) router.replace('/');
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No pudimos completar el acceso.'); });
    return () => { active = false; };
  }, [params.code, params.error]);
  return <View style={styles.page}>
    {error ? <><Text accessibilityRole="alert" style={[styles.message, { color: text }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={[styles.button, { backgroundColor: preferences.tasks }]}><Text style={{ color: '#fff' }}>Volver a Día Uno</Text></Pressable></> : <><ActivityIndicator color={preferences.tasks} /><Text style={{ color: muted }}>Completando el inicio de sesión…</Text></>}
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }, message: { textAlign: 'center', fontFamily: 'Manrope-Regular', fontSize: 16 }, button: { padding: 16, borderRadius: 14 } });
