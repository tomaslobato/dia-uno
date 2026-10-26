import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

export type TimePickerAnchor = { x: number; y: number };

/** Reads click coordinates from a Pressable event. Native builds ignore anchoring. */
export function timePickerAnchorFromEvent(_event?: { nativeEvent?: { clientX?: number; clientY?: number; pageX?: number; pageY?: number } }): TimePickerAnchor | undefined {
  return undefined;
}

/** Opens native time UI when possible. Returns true if the caller should show an inline picker (iOS). */
export function pickTime(value: Date, onPick: (date: Date) => void, _anchor?: TimePickerAnchor): boolean {
  if (Platform.OS === 'android') {
    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      is24Hour: true,
      onValueChange: (_event, selected) => {
        onPick(selected);
      },
    });
    return false;
  }
  return true;
}
