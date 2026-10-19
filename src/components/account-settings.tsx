import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Pressable from '@/components/feedback-pressable';
import { useData } from '@/data/data-provider';
import { useAuth } from '@/auth/auth-provider';
import { useAppearance } from '@/theme/appearance';

export default function AccountSettings() {
  const { session, ready, busy, error, signIn, signOut } = useAuth();
  const { status, pending, error: syncError } = useData();
  const { text, muted, border } = useAppearance();
  const actionLabel = busy ? 'Un momento…' : !ready ? 'Cargando cuenta…' : session ? 'Cerrar sesión' : 'Continuar con Google';
  return <View style={[styles.section, { borderBottomColor: border }]}>
    <Text style={[styles.title, { color: text }]}>Cuenta</Text>
    <Text style={{ color: muted }}>{session ? session.user.email ?? 'Sesión iniciada' : 'Puedes seguir usando Día Uno sin iniciar sesión.'}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} disabled={!ready || busy} onPress={() => void (session ? signOut() : signIn())} style={[styles.button, { borderColor: border, opacity: !ready || busy ? 0.5 : 1 }]}>
      <MaterialIcons name={session ? 'logout' : 'login'} size={20} color={text} />
      <Text style={{ color: text }}>{actionLabel}</Text>
    </Pressable>
    <Text style={[styles.note, { color: muted }]}>{!session ? 'Sin cuenta, tus tareas y hábitos se guardan solo en este dispositivo.' : status === 'synced' ? 'Tareas y hábitos guardados en tu cuenta.' : status === 'syncing' ? 'Sincronizando tareas y hábitos…' : status === 'loading' ? 'Cargando tus datos…' : pending ? `${pending} cambios pendientes de sincronizar. Se conservan en este dispositivo.` : 'Esperando conexión con Supabase.'}</Text>
    {syncError && <Text accessibilityRole="alert" style={{ color: '#d65c66' }}>{syncError}</Text>}
    {error && <Text accessibilityRole="alert" style={{ color: '#d65c66' }}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 12, borderBottomWidth: 1, paddingBottom: 18 },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 15, fontWeight: 'normal' },
  button: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  note: { fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 18 },
});
