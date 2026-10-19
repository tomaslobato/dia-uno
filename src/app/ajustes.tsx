import AccountSettings from '@/components/account-settings';
import AppearanceSettings from '@/components/appearance-settings';
import { SectionEntrance } from '@/components/section-motion';
import { useSectionStyles } from '@/theme/appearance';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

export default function SettingsScreen() {
  const { styles } = useSectionStyles(makeStyles, 'tasks');
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const [appearanceY, setAppearanceY] = useState<number | null>(null);
  useEffect(() => {
    if (focus !== 'personalizacion' || appearanceY === null) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, appearanceY - 8), animated: true });
      router.setParams({ focus: undefined });
    });
    return () => cancelAnimationFrame(frame);
  }, [appearanceY, focus]);
  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <View style={styles.page}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionEntrance section="/ajustes" order={0}><Text accessibilityRole="header" style={styles.title}>Ajustes</Text></SectionEntrance>
        <SectionEntrance section="/ajustes" order={1}><AccountSettings /></SectionEntrance>
        <View onLayout={(event) => setAppearanceY((current) => current === event.nativeEvent.layout.y ? current : event.nativeEvent.layout.y)}><SectionEntrance section="/ajustes" order={2}><AppearanceSettings /></SectionEntrance></View>
      </ScrollView>
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
