import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { habitGreetings } from '@/constants/habit-greetings';

const STORAGE_KEY = 'habitos.greeting.v1';
let queue = Promise.resolve();

export function useHabitGreeting() {
  const [greeting, setGreeting] = useState<(typeof habitGreetings)[number]>(habitGreetings[0]);
  useFocusEffect(useCallback(() => {
    let active = true;
    function refresh() {
      queue = queue.then(async () => {
        if (!active) return;
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        const previous = stored === null ? -1 : Number(stored);
        const next = Number.isInteger(previous) && previous >= -1 && previous < habitGreetings.length ? (previous + 1) % habitGreetings.length : 0;
        await AsyncStorage.setItem(STORAGE_KEY, String(next));
        if (active) setGreeting(habitGreetings[next]);
      }).catch(() => {
        if (active) setGreeting((current) => habitGreetings[(habitGreetings.indexOf(current) + 1) % habitGreetings.length]);
      });
    }
    refresh();
    let lastState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && lastState !== 'active') refresh();
      lastState = state;
    });
    return () => { active = false; subscription.remove(); };
  }, []));
  return greeting;
}
