import AccountSettings from '@/components/account-settings';
import AppearanceSettings from '@/components/appearance-settings';
import SectionTabs from '@/components/section-tabs';
import { useSectionStyles } from '@/theme/appearance';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  const { styles } = useSectionStyles(makeStyles, 'tasks');
  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <View style={styles.page}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>Ajustes</Text>
        <AccountSettings />
        <AppearanceSettings />
      </ScrollView>
      <SectionTabs active="settings" />
    </View>
  </SafeAreaView>;
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color('#f8fafd') },
  page: { flex: 1, width: '100%', maxWidth: 660, alignSelf: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, gap: 20 },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 30, lineHeight: 38, color: color('#202124'), letterSpacing: -1 },
});
