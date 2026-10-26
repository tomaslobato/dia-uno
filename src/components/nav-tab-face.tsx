import Pressable from '@/components/feedback-pressable';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

const nativeDriver = Platform.OS !== 'web';

export default function NavTabFace({
  active,
  accent,
  dark,
  children,
}: {
  active: boolean;
  accent: string;
  dark: boolean;
  children: ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));
  const reduceMotion = useRef(false);

  useEffect(() => {
    let activeListener = true;
    const update = (enabled: boolean) => {
      if (!activeListener) return;
      reduceMotion.current = enabled;
      if (enabled) progress.setValue(active ? 1 : 0);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => { activeListener = false; listener.remove(); };
  }, [active, progress]);

  useEffect(() => {
    if (reduceMotion.current) {
      progress.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.spring(progress, {
      toValue: active ? 1 : 0,
      speed: 22,
      bounciness: 8,
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.face,
        {
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
          ],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.tint,
          {
            backgroundColor: `${accent}${dark ? '35' : '20'}`,
            opacity: progress,
          },
        ]}
      />
      {children}
    </Animated.View>
  );
}

export function NavTabIcon({ active, children }: { active: boolean; children: ReactNode }) {
  const [scale] = useState(() => new Animated.Value(active ? 1.12 : 1));
  useEffect(() => {
    const animation = Animated.spring(scale, {
      toValue: active ? 1.12 : 1,
      speed: 24,
      bounciness: 7,
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [active, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

export function NavTabButton({
  active,
  accent,
  dark,
  onPress,
  accessibilityLabel,
  style,
  children,
}: {
  active: boolean;
  accent: string;
  dark: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [press] = useState(() => new Animated.Value(1));
  const reduceMotion = useRef(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) reduceMotion.current = enabled;
    }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotion.current = enabled;
      if (enabled) press.setValue(1);
    });
    return () => listener.remove();
  }, [press]);

  function bump(to: number, speed: number, bounciness: number) {
    if (reduceMotion.current) {
      press.setValue(1);
      return;
    }
    Animated.spring(press, { toValue: to, speed, bounciness, useNativeDriver: nativeDriver }).start();
  }

  return (
    <Pressable
      feedback={false}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onPress={onPress}
      onPressIn={() => bump(0.88, 55, 0)}
      onPressOut={() => bump(1, 18, 10)}
      style={style}
    >
      <Animated.View style={[styles.pressWrap, { transform: [{ scale: press }] }]}>
        <NavTabFace active={active} accent={accent} dark={dark}>
          {children}
        </NavTabFace>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    width: '82%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  tint: { borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden' },
  pressWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
});
