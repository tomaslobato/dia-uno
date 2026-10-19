import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';

import Pressable from '@/components/feedback-pressable';

const DayPressContext = createContext<() => boolean>(() => true);
export function AgendaPressGuard({ canPress, children }: { canPress: () => boolean; children: ReactNode }) { return <DayPressContext.Provider value={canPress}>{children}</DayPressContext.Provider>; }
export function useAgendaCanPress() { return useContext(DayPressContext); }
export function AgendaDayButton({ onPress, ...props }: ComponentProps<typeof Pressable>) {
  const canOpen = useContext(DayPressContext);
  return <Pressable {...props} onPress={(event) => { if (canOpen()) onPress?.(event); }} />;
}

type Props = { enabled: boolean; pageKey: string; onStep: (direction: number) => void; renderNeighbor: (direction: number) => ReactNode; children: ReactNode };
export default function AgendaPager({ enabled, pageKey, onStep, renderNeighbor, children }: Props) {
  const [position] = useState(() => new Animated.Value(-320));
  const [width, setWidth] = useState(320);
  const [moving, setMoving] = useState(false);
  const busy = useRef(false);
  const gestureActive = useRef(false);
  const canOpenDay = useCallback(() => !busy.current && !gestureActive.current, []);
  const reduced = useRef(true);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive.current) reduced.current = value; }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { reduced.current = value; });
    return () => { alive.current = false; position.stopAnimation(); listener.remove(); };
  }, [position]);
  // Swap the three pages and recenter them together, before the next paint.
  useLayoutEffect(() => {
    position.stopAnimation();
    position.setValue(-width);
    const frame = requestAnimationFrame(() => { busy.current = false; gestureActive.current = false; if (alive.current) setMoving(false); });
    return () => cancelAnimationFrame(frame);
  }, [pageKey, enabled, width, position]);
  const responder = useMemo(() => {
    const reset = () => Animated.spring(position, { toValue: -width, speed: 35, bounciness: 0, useNativeDriver: false }).start(() => { gestureActive.current = false; });
    // PanResponder stores gesture callbacks; refs are accessed only during gestures.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => enabled && !busy.current && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderGrant: () => { gestureActive.current = true; position.stopAnimation(); },
      onPanResponderMove: (_, gesture) => { if (!reduced.current) position.setValue(-width + Math.max(-width, Math.min(width, gesture.dx))); },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < Math.max(48, width * 0.15)) { reset(); return; }
        const direction = gesture.dx < 0 ? 1 : -1;
        busy.current = true;
        setMoving(true);
        if (reduced.current) { onStep(direction); return; }
        Animated.timing(position, { toValue: -width - direction * width, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
          if (finished && alive.current) onStep(direction);
          else { busy.current = false; gestureActive.current = false; if (alive.current) setMoving(false); }
        });
      },
      onPanResponderTerminate: reset,
      onPanResponderTerminationRequest: () => false,
    });
  }, [enabled, onStep, position, width]);
  return <DayPressContext.Provider value={canOpenDay}><View pointerEvents={moving ? 'none' : 'auto'} {...responder.panHandlers} testID="agenda-pager" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.frame}>
    {enabled ? <Animated.View testID="agenda-block-strip" style={[styles.strip, { width: width * 3, transform: [{ translateX: position }] }]}>
      {([-1, 0, 1] as const).map((direction) => <View key={direction} testID={`agenda-block-page-${direction}`} pointerEvents={direction === 0 ? 'auto' : 'none'} accessibilityElementsHidden={direction !== 0} importantForAccessibility={direction === 0 ? 'auto' : 'no-hide-descendants'} aria-hidden={direction !== 0} style={[styles.page, { width }]}>{direction === 0 ? children : renderNeighbor(direction)}</View>)}
    </Animated.View> : children}
  </View></DayPressContext.Provider>;
}
const styles = StyleSheet.create({ frame: { flex: 1, overflow: 'hidden' }, strip: { flex: 1, flexDirection: 'row' }, page: { flexShrink: 0 } });
