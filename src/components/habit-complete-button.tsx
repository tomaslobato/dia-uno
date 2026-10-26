import Pressable from '@/components/feedback-pressable';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet } from 'react-native';

type Props = {
  checked: boolean;
  accent: string;
  mark: 'add' | 'close';
  label: string;
  onToggle: () => void;
};

const nativeDriver = Platform.OS !== 'web';

export default function HabitCompleteButton({ checked, accent, mark, label, onToggle }: Props) {
  const previous = useRef(checked);
  const reduceMotion = useRef(false);
  const [scale] = useState(() => new Animated.Value(1));
  const [burst] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    const update = (enabled: boolean) => {
      if (!active) return;
      reduceMotion.current = enabled;
      if (enabled) {
        scale.stopAnimation();
        burst.stopAnimation();
        scale.setValue(1);
        burst.setValue(0);
      }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => { active = false; listener.remove(); };
  }, [scale, burst]);

  useEffect(() => {
    const becameChecked = checked && !previous.current;
    const becameUnchecked = !checked && previous.current;
    previous.current = checked;
    if (reduceMotion.current || (!becameChecked && !becameUnchecked)) return;

    if (becameChecked) {
      scale.setValue(0.82);
      burst.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.18, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
          Animated.spring(scale, { toValue: 1, speed: 28, bounciness: 8, useNativeDriver: nativeDriver }),
        ]),
        Animated.timing(burst, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
      ]).start();
      return;
    }

    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 90, easing: Easing.in(Easing.cubic), useNativeDriver: nativeDriver }),
      Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 4, useNativeDriver: nativeDriver }),
    ]).start();
  }, [checked, scale, burst]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        aria-checked={checked}
        accessibilityState={{ checked }}
        hitSlop={8}
        onPress={(event) => { event.stopPropagation(); onToggle(); }}
        style={[styles.check, checked && { backgroundColor: accent, borderColor: accent }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.burst,
            {
              borderColor: accent,
              opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] }),
              transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.7] }) }],
            },
          ]}
        />
        <MaterialIcons name={checked ? 'check' : mark} size={26} color={checked ? '#fff' : accent} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  check: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4A4A52',
    backgroundColor: '#1C1C22',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  burst: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    borderWidth: 2,
  },
});
