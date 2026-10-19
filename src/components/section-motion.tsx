import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { useGlobalSearchParams, usePathname } from 'expo-router';

type Direction = 'left' | 'right';
type Request = { id: number; pathname: string; direction: Direction; clearAgendaDay?: boolean };
type MotionContextValue = { offset: Animated.Value; request: (pathname: string, direction: Direction, clearAgendaDay?: boolean) => void; pending: Request | null; finish: (id: number) => void };
const MotionContext = createContext<MotionContextValue | null>(null);

export function SectionMotionProvider({ children }: { children: ReactNode }) {
  const [offset] = useState(() => new Animated.Value(0));
  const [pending, setPending] = useState<Request | null>(null);
  const sequence = useRef(0);
  const request = useCallback((pathname: string, direction: Direction, clearAgendaDay?: boolean) => {
    setPending({ id: ++sequence.current, pathname, direction, clearAgendaDay });
  }, []);
  const finish = useCallback((id: number) => setPending((current) => current?.id === id ? null : current), []);
  return <MotionContext.Provider value={{ offset, request, pending, finish }}>{children}</MotionContext.Provider>;
}

export function SectionMotionSurface({ background, children }: { background: string; children: ReactNode }) {
  const motion = useContext(MotionContext);
  if (!motion) throw new Error('SectionMotionProvider is required');
  const pathname = usePathname();
  const { day } = useGlobalSearchParams<{ day?: string }>();
  const { offset, pending, finish } = motion;

  useLayoutEffect(() => {
    if (!pending || pathname !== pending.pathname || (pending.clearAgendaDay && day)) return;
    offset.stopAnimation();
    offset.setValue(pending.direction === 'right' ? -20 : 20);
    const animation = Animated.timing(offset, {
      toValue: 0,
      duration: 165,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start(({ finished }) => { if (finished) finish(pending.id); });
    return () => animation.stop();
  }, [day, finish, offset, pathname, pending]);

  return <View style={{ flex: 1, backgroundColor: background }}><Animated.View style={{ flex: 1, transform: [{ translateX: motion.offset }] }}>{children}</Animated.View></View>;
}

export function useSectionMotion() {
  const motion = useContext(MotionContext);
  if (!motion) throw new Error('SectionMotionProvider is required');
  return motion.request;
}
