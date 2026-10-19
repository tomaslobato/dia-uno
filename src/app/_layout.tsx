import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { DataProvider, useData } from '@/data/data-provider';
import StreakLossNotice from '@/components/streak-loss-notice';
import { HabitAttentionProvider } from '@/hooks/habit-attention';
import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider, useAppearance } from '@/theme/appearance';
import { synchronizeTaskReminders } from '@/notifications/task-reminders';
import SectionTabs from '@/components/section-tabs';
import { View } from 'react-native';
import FirstRunWelcome from '@/components/first-run-welcome';

void SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { preferences, background } = useAppearance();
  const { session } = useAuth();
  const { tasks, ready } = useData();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(background).catch(() => {});
  }, [background]);
  useEffect(() => {
    if (ready) void synchronizeTaskReminders(tasks).catch((error) => console.warn('No se pudieron actualizar los recordatorios', error));
  }, [tasks, ready]);
  const owner = session?.user.id ?? 'guest';
  return <HabitAttentionProvider key={owner} owner={owner}><StatusBar style={preferences.dark ? 'light' : 'dark'} /><View style={{ flex: 1, backgroundColor: background }}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}><Stack.Screen name="index" options={{ animation: 'fade', animationDuration: 220 }} /><Stack.Screen name="habitos" options={{ animation: 'fade', animationDuration: 220 }} /><Stack.Screen name="agenda" options={{ animation: 'fade', animationDuration: 220 }} /><Stack.Screen name="ajustes" options={{ animation: 'fade', animationDuration: 220 }} /></Stack><SectionTabs /></View><FirstRunWelcome owner={owner} /><StreakLossNotice owner={owner} /></HabitAttentionProvider>;
}
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Manrope-Regular': require('../../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../../assets/fonts/Manrope-SemiBold.ttf'),
    'Manrope-Bold': require('../../assets/fonts/Manrope-Bold.ttf'),
  });
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return <SafeAreaProvider><AppearanceProvider><AuthProvider><DataProvider><Navigation /></DataProvider></AuthProvider></AppearanceProvider></SafeAreaProvider>;
}
