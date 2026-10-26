import Pressable from '@/components/feedback-pressable';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';

const nativeDriver = Platform.OS !== 'web';

/** Date-group block that fades when another day is being focused. */
export default function TaskDaySection({
  title,
  fadingOut,
  selected,
  onPress,
  titleStyle,
  selectedTitleStyle,
  children,
}: {
  title: string;
  fadingOut: boolean;
  selected: boolean;
  onPress: () => void;
  titleStyle: TextStyle;
  selectedTitleStyle?: TextStyle;
  children: ReactNode;
}) {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: fadingOut ? 0 : 1,
      duration: fadingOut ? 200 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [fadingOut, opacity]);

  return (
    <Animated.View pointerEvents={fadingOut ? 'none' : 'auto'} style={[styles.section, { opacity }]}>
      <Pressable
        feedback={false}
        accessibilityRole="button"
        accessibilityLabel={selected ? `${title}, filtrado` : title}
        accessibilityHint={selected ? 'Toca de nuevo para ver todos los días' : 'Mostrar solo las tareas de este día'}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={styles.header}
      >
        <Text accessibilityRole="header" style={[titleStyle, selected && selectedTitleStyle]}>{title}</Text>
      </Pressable>
      <View>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 12 },
  header: { alignSelf: 'flex-start', paddingVertical: 2, paddingRight: 12 },
});
