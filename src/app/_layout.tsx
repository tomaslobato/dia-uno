import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { DataProvider } from '@/data/data-provider';
import StreakLossNotice from '@/components/streak-loss-notice';
import { HabitAttentionProvider } from '@/hooks/habit-attention';
import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider, useAppearance } from '@/theme/appearance';
import { SectionMotionProvider, SectionMotionSurface } from '@/components/section-motion';

void SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { preferences, background } = useAppearance();
  const { session } = useAuth();
  const owner = session?.user.id ?? 'guest';
  return <HabitAttentionProvider key={owner} owner={owner}><StatusBar style={preferences.dark ? 'light' : 'dark'} /><SectionMotionProvider><SectionMotionSurface background={background}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}><Stack.Screen name="index" options={{ animation: 'none' }} /><Stack.Screen name="habitos" options={{ animation: 'none' }} /><Stack.Screen name="agenda" options={{ animation: 'none' }} /><Stack.Screen name="ajustes" options={{ animation: 'none' }} /></Stack></SectionMotionSurface><StreakLossNotice key={owner} owner={owner} /></SectionMotionProvider></HabitAttentionProvider>;
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
