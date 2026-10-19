import { useAuth } from '@/auth/auth-provider';
import Pressable from '@/components/feedback-pressable';
import NavTabFace, { NavTabIcon } from '@/components/nav-tab-face';
import { accentTextColor, useAppearance } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';

export default function SettingsTab({ active, inactiveColor, onPress }: { active: boolean; inactiveColor: string; onPress: () => void }) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const { session } = useAuth();
  const metadata = session?.user.user_metadata;
  const photo = [metadata?.avatar_url, metadata?.picture].find((value): value is string => typeof value === 'string' && value.startsWith('https://'));
  const avatarKey = photo ? `${session?.user.id}:${photo}` : null;
  const { preferences, border } = useAppearance();
  const selectedColor = accentTextColor(preferences.tasks, preferences.dark);
  const itemColor = active ? selectedColor : inactiveColor;
  return <Pressable accessibilityRole="tab" accessibilityLabel="Ajustes" accessibilityState={{ selected: active }} aria-selected={active} onPress={onPress} style={styles.tab}>
    <NavTabFace active={active} accent={preferences.tasks} dark={preferences.dark}>
      <NavTabIcon active={active}>{photo && avatarKey !== failedAvatar ? <Image key={avatarKey} source={{ uri: photo }} style={[styles.avatar, { borderColor: border }]} resizeMode="cover" accessibilityLabel="Foto de perfil de Google" onError={() => setFailedAvatar(avatarKey)} /> : <MaterialIcons name={session ? 'account-circle' : 'settings'} size={24} color={itemColor} />}</NavTabIcon>
      <Text numberOfLines={1} style={[styles.label, { color: itemColor }]}>Ajustes</Text>
    </NavTabFace>
  </Pressable>;
}

const styles = StyleSheet.create({
  tab: { width: '25%', flexGrow: 0, flexShrink: 0, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, overflow: 'visible' },
  avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  label: { fontFamily: 'Manrope-Medium', fontSize: 10, lineHeight: 13, fontWeight: 'normal' },
});
