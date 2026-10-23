import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

/** Opens native time UI when possible. Returns true if the caller should show an inline picker (iOS). */
export function pickTime(value: Date, onPick: (date: Date) => void): boolean {
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
