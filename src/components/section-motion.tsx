import { usePathname } from 'expo-router';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform } from 'react-native';

/** Fades each major block in sequence whenever its section becomes active. */
export function SectionEntrance({ section, order, children, style }: { section: string; order: number; children: ReactNode; style?: object }) {
  const pathname = usePathname();
  const [opacity] = useState(() => new Animated.Value(0));
  const wasActive = useRef(false);
  const active = pathname === section;

  useLayoutEffect(() => {
    if (active && !wasActive.current) {
      opacity.stopAnimation();
      opacity.setValue(0);
      const animation = Animated.timing(opacity, {
        toValue: 1,
        duration: 170,
        delay: Math.min(order, 7) * 38,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      });
      animation.start();
    }
    wasActive.current = active;
  }, [active, opacity, order]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
