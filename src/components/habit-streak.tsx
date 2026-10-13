import { useAppearance } from '@/theme/appearance';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text } from 'react-native';
import { habitStreak, type Habit } from '@/models/habit';

export default function HabitStreak({ habit, today }: { habit: Habit; today: string }) {
  const { preferences } = useAppearance();
  const count = habitStreak(habit, today);
  const previous = useRef(count);
  const reduceMotion = useRef(false);
  const [celebration] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true;
    const update = (enabled: boolean) => {
      if (!active) return;
      reduceMotion.current = enabled;
      if (enabled) { celebration.stopAnimation(); celebration.setValue(1); }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => { active = false; listener.remove(); };
  }, [celebration]);
  useEffect(() => {
    const unlocked = count > previous.current;
    previous.current = count;
    if (!unlocked || reduceMotion.current) { celebration.setValue(1); return; }
    celebration.setValue(0);
    const animation = Animated.timing(celebration, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [count, celebration]);
  return <Animated.View accessible accessibilityLabel={`Racha: ${count} ${count === 1 ? 'vez' : 'veces'}`} accessibilityLiveRegion="polite" style={[styles.badge, count === 0 && styles.cold, preferences.dark && { backgroundColor: count ? '#49301e' : '#263644' }, {
    transform: [{ scale: celebration.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 1.18, 0.98, 1.05, 1] }) }],
  }]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, {
      opacity: celebration.interpolate({ inputRange: [0, 0.15, 0.65, 1], outputRange: [0, 0.8, 0.35, 0] }),
      transform: [{ scale: celebration.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
    }]} />
    <Animated.Text style={[styles.emoji, {
      transform: [
        { translateY: celebration.interpolate({ inputRange: [0, 0.25, 0.5, 1], outputRange: [0, -5, 1, 0] }) },
        { rotate: celebration.interpolate({ inputRange: [0, 0.2, 0.4, 0.65, 1], outputRange: ['0deg', '-12deg', '10deg', '-4deg', '0deg'] }) },
      ],
    }]}>{count > 0 ? '🔥' : '🧊'}</Animated.Text>
    <Text style={[styles.count, count === 0 && styles.coldText, preferences.dark && { color: count ? '#ffc28d' : '#b3d4ed' }]}>{count}</Text>
  </Animated.View>;
}
const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', height: 38, justifyContent: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 14, backgroundColor: '#fff3e6' },
  glow: { borderRadius: 14, borderWidth: 2, borderColor: '#f3a548', backgroundColor: '#f3a54822' },
  cold: { backgroundColor: '#edf4fa' }, emoji: { fontFamily: 'Manrope-Regular', fontSize: 18, lineHeight: 23, includeFontPadding: false }, count: { fontFamily: 'Manrope-SemiBold', fontSize: 15, lineHeight: 21, includeFontPadding: false, fontWeight: 'normal', color: '#b65b16' }, coldText: { color: '#6e8ba4' },
});
