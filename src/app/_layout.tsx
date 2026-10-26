import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { DataProvider, useData } from '@/data/data-provider';
import StreakLossNotice from '@/components/streak-loss-notice';
import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { Stack, useLocalSearchParams, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider, useAppearance } from '@/theme/appearance';
import { synchronizeHabitReminders } from '@/notifications/habit-reminders';
import { synchronizeTaskReminders } from '@/notifications/task-reminders';
import SectionTabs from '@/components/section-tabs';
import { Platform, View } from 'react-native';
import FirstRunWelcome from '@/components/first-run-welcome';

void SplashScreen.preventAutoHideAsync();

function sectionTitle(pathname: string, day?: string) {
  if (pathname === '/habitos') return 'Hábitos';
  if (pathname === '/agenda' || day) return 'Agenda';
  if (pathname === '/ajustes') return 'Ajustes';
  return 'Tareas';
}

function sectionAccent(pathname: string, day: string | undefined, accents: { tasks: string; habits: string; agenda: string }) {
  if (pathname === '/habitos') return accents.habits;
  if (pathname === '/agenda' || day) return accents.agenda;
  // Ajustes reuses the tasks accent, same as the settings tab.
  return accents.tasks;
}

/** Habit-day mark as a data-URI favicon so the fill can follow the live section accent. */
function sectionFavicon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 1024 1024"><rect x="302" y="302" width="420" height="420" rx="140" ry="140" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function Navigation() {
  const { preferences, background } = useAppearance();
  const { session } = useAuth();
  const { tasks, habits, ready } = useData();
  const pathname = usePathname();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const accent = sectionAccent(pathname, day, preferences);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(background).catch(() => {});
  }, [background]);
  useEffect(() => {
    if (ready) void synchronizeTaskReminders(tasks).catch((error) => console.warn('No se pudieron actualizar los recordatorios', error));
  }, [tasks, ready]);
  useEffect(() => {
    if (ready) void synchronizeHabitReminders(habits).catch((error) => console.warn('No se pudieron actualizar los recordatorios de hábitos', error));
  }, [habits, ready]);
  const owner = session?.user.id ?? 'guest';
  return <>
    {Platform.OS === 'web' && <Head>
      <title>{`Día Uno | ${sectionTitle(pathname, day)}`}</title>
      <link rel="icon" href={sectionFavicon(accent)} type="image/svg+xml" />
    </Head>}
    <StatusBar style={preferences.dark ? 'light' : 'dark'} /><View style={{ flex: 1, backgroundColor: background }}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}><Stack.Screen name="index" options={{ animation: 'fade', animationDuration: 220 }} /><Stack.Screen name="habitos" options={{ animation: 'fade', animationDuration: 220 }} /><Stack.Screen name="agenda" options={{ animation: 'fade', animationDuration: 220 }} /><Stack.Screen name="ajustes" options={{ animation: 'fade', animationDuration: 220 }} /></Stack><SectionTabs /></View><FirstRunWelcome owner={owner} /><StreakLossNotice owner={owner} /></>;
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
