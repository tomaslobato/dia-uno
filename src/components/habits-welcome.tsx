import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Pressable from '@/components/feedback-pressable';
import { accentTextColor, useAppearance, useSectionStyles } from '@/theme/appearance';

export function HabitsWelcomeGuide({ buttonLabel, onContinue, disabled = false, errorMessage, showArrow = false, brightenDark = false, fixedFooter = false, buttonColor }: { buttonLabel: string; onContinue: () => void; disabled?: boolean; errorMessage?: string; showArrow?: boolean; brightenDark?: boolean; fixedFooter?: boolean; buttonColor?: string }) {
  const { styles: themedStyles } = useSectionStyles(makeStyles, 'habits');
  const { preferences } = useAppearance();
  const styles = useMemo(() => {
    if (!brightenDark || !preferences.dark) return themedStyles;
    const habitAccent = accentTextColor(preferences.habits, true);
    const brighter: Record<string, string> = {
      '#fff': '#303640', '#202124': '#f2f4f8', '#5f6368': '#c3c9d2', '#e6f4ea': `${preferences.habits}35`,
      '#188038': habitAccent, '#f3f6f4': '#3a414b', '#c8d9cd': '#80636b', '#34a853': habitAccent,
    };
    return makeStyles((value) => brighter[value] ?? value);
  }, [brightenDark, preferences.dark, preferences.habits, themedStyles]);
  const guideContent = <>
      <View style={styles.guideIconWrap}>
        <View style={[styles.guideIcon, brightenDark && { backgroundColor: `${preferences.habits}18`, borderColor: preferences.habits, borderWidth: 2.5 }]}>
          {brightenDark ? <MaterialIcons name="local-fire-department" size={34} color={preferences.habits} /> : <Text style={styles.emoji}>🌱</Text>}
        </View>
      </View>
    <Text accessibilityRole="header" style={styles.title}>Cada día cuenta</Text>
    <View style={styles.section}>
      <Text style={styles.heading}>Tu historial, día a día</Text>
      <View accessible accessibilityLabel="Ejemplo: tres días completados y cuatro sin completar" style={styles.dots}>{[true, true, false, true, false, false, false].map((done, i) => <View key={i} style={[styles.dot, done && styles.done]} />)}</View>
      <Text style={styles.message}>Relleno si cumpliste, vacío si no.</Text>
    </View>
    <View style={styles.section}>
      <Text style={styles.heading}>📅 Tú eliges el ritmo</Text>
      <Text style={styles.message}>Tú eliges cada cuántos días quieres cumplir el hábito.</Text>
      <View accessible accessibilityLabel="Ejemplo de frecuencia: cada 1 día" style={styles.stepper}>
        <Text style={styles.message}>Cada</Text>
        <View style={styles.stepButton}><Text style={styles.stepSymbol}>−</Text></View>
        <View style={styles.stepNumber}><Text style={styles.number}>1</Text></View>
        <View style={styles.stepButton}><Text style={styles.stepSymbol}>+</Text></View>
        <Text style={styles.message}>Días</Text>
      </View>
    </View>
    <View style={styles.section}>
      <Text style={styles.heading}>🔥 Mantén tu racha</Text>
      <Text style={styles.message}>Cumple dentro del plazo para mantener tu racha 🔥, si no lo haces, vuelves a cero 🧊.</Text>
    </View>
    {errorMessage && <Text style={styles.message}>{errorMessage}</Text>}
  </>;
  const action = <Pressable accessibilityRole="button" disabled={disabled} onPress={onContinue} style={[styles.button, buttonColor && { backgroundColor: buttonColor }]}><Text style={styles.buttonText}>{buttonLabel}</Text>{showArrow && <MaterialIcons name="arrow-forward" size={20} color="#fff" />}</Pressable>;
  if (fixedFooter) return <View style={styles.guideContainer}>
    <ScrollView style={styles.guideScroll} contentContainerStyle={styles.content}>
      {guideContent}
    </ScrollView>
    <View style={styles.guideFooter}>{action}</View>
  </View>;
  return <ScrollView contentContainerStyle={styles.content}>{guideContent}{action}</ScrollView>;
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  guideContainer: { flex: 1 }, guideScroll: { flex: 1 }, guideFooter: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18 },
  content: { padding: 24, gap: 22 }, guideIconWrap: { width: '100%', alignItems: 'center' }, guideIcon: { width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, emoji: { fontFamily: 'Manrope-Regular', fontSize: 32, textAlign: 'center' },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 25, fontWeight: 'normal', color: color('#202124'), textAlign: 'center' },
  section: { gap: 12 }, heading: { fontFamily: 'Manrope-SemiBold', fontSize: 17, fontWeight: 'normal', color: color('#202124') },
  message: { fontFamily: 'Manrope-Regular', fontSize: 15, lineHeight: 23, color: color('#5f6368') }, dots: { flexDirection: 'row', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: color('#e6f4ea'), alignItems: 'center', justifyContent: 'center' },
  stepSymbol: { fontFamily: 'Manrope-Regular', fontSize: 23, lineHeight: 28, color: color('#188038') },
  stepNumber: { width: 40, height: 36, borderRadius: 10, backgroundColor: color('#f3f6f4'), alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: 'Manrope-Regular', fontSize: 19, color: color('#202124') },
  dot: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: color('#c8d9cd'), backgroundColor: color('#fff') }, done: { backgroundColor: color('#34a853'), borderColor: color('#34a853') },
  button: { flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: color('#188038') }, buttonText: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 16, fontWeight: 'normal' },
});
