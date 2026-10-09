import { useRef, type ComponentProps } from 'react';
import { Animated, Platform, Pressable, StyleSheet } from 'react-native';
import { useAppearance } from '@/theme/appearance';

type Props = ComponentProps<typeof Pressable> & { feedback?: boolean };
export default function FeedbackPressable({ children, style, onPressIn, onPressOut, android_ripple, feedback = true, ...props }: Props) {
  const { preferences } = useAppearance();
  const opacity = useRef(new Animated.Value(0)).current;
  const shade = preferences.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  function animate(value: number, duration: number) {
    if (feedback && Platform.OS !== 'android') Animated.timing(opacity, { toValue: value, duration, useNativeDriver: Platform.OS !== 'web' }).start();
  }
  return <Pressable {...props} android_ripple={feedback ? android_ripple ?? { color: shade, foreground: true } : undefined}
    onPressIn={(event) => { animate(1, 65); onPressIn?.(event); }}
    onPressOut={(event) => { animate(0, 180); onPressOut?.(event); }} style={style}>
    {(state) => {
      const resolved = StyleSheet.flatten(typeof style === 'function' ? style(state) : style);
      return <>{typeof children === 'function' ? children(state) : children}{feedback && Platform.OS !== 'android' && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, backgroundColor: shade, borderRadius: resolved?.borderRadius ?? 8, borderTopLeftRadius: resolved?.borderTopLeftRadius, borderTopRightRadius: resolved?.borderTopRightRadius, borderBottomLeftRadius: resolved?.borderBottomLeftRadius, borderBottomRightRadius: resolved?.borderBottomRightRadius }]} />}</>;
    }}
  </Pressable>;
}
