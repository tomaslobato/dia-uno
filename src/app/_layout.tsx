import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider, useAppearance } from '@/theme/appearance';

function Navigation() {
  const { preferences, background } = useAppearance();
  return <><StatusBar style={preferences.dark ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }} /></>;
}
export default function RootLayout() {
  return <SafeAreaProvider><AppearanceProvider><Navigation /></AppearanceProvider></SafeAreaProvider>;
}
