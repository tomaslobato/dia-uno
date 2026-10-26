import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { HabitSymbol } from '@/models/habit';

type Props = {
  symbol: HabitSymbol;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

type IconName = ComponentProps<typeof MaterialIcons>['name'];

export default function HabitSymbolView({ symbol, color = '#fff', size = 28, style, textStyle }: Props) {
  if (symbol.type === 'emoji') {
    return <View style={[styles.wrap, style]}><Text style={[{ fontSize: size * 0.9, lineHeight: size }, textStyle]}>{symbol.value}</Text></View>;
  }
  return <View style={[styles.wrap, style]}><MaterialIcons name={symbol.name as IconName} size={size} color={color} /></View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
