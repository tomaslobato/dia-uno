import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type Preferences = { dark: boolean; tasks: string; habits: string; agenda: string };
const defaults: Preferences = { dark: false, tasks: '#1a73e8', habits: '#d65c66', agenda: '#8755c5' };
const Context = createContext<{ preferences: Preferences; update: (change: Partial<Preferences>) => void; ready: boolean; error: string | null } | null>(null);
export const colorChoices = [
  { name: 'Rojo claro', value: '#d65c66' }, { name: 'Azul', value: '#1a73e8' },
  { name: 'Verde', value: '#188038' }, { name: 'Violeta', value: '#8755c5' },
  { name: 'Naranja', value: '#b96a24' }, { name: 'Rosa', value: '#bf4f91' },
];
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    const previous = root.style.colorScheme;
    root.style.colorScheme = preferences.dark ? 'dark' : 'light';
    return () => { root.style.colorScheme = previous; };
  }, [preferences.dark]);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('tareas.appearance.v1').then((raw) => {
      if (!active) return;
      if (raw) {
        const stored = JSON.parse(raw);
        if (typeof stored.dark !== 'boolean' || !/^#[a-f\d]{6}$/i.test(stored.tasks) || !/^#[a-f\d]{6}$/i.test(stored.habits) || (stored.agenda !== undefined && !/^#[a-f\d]{6}$/i.test(stored.agenda))) throw new Error('Invalid preferences');
        setPreferences({ ...defaults, ...stored });
      }
      setReady(true);
    }).catch(() => { if (active) setError('No pudimos cargar la apariencia. Volvé a abrir la app.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    writes.current = writes.current.then(() => AsyncStorage.setItem('tareas.appearance.v1', JSON.stringify(preferences))).then(() => setError(null)).catch(() => setError('No pudimos guardar la apariencia.'));
  }, [preferences, ready]);
  return <Context.Provider value={{ preferences, ready, error, update: (change) => setPreferences((current) => ({ ...current, ...change })) }}>{children}</Context.Provider>;
}
export function useAppearance() {
  const context = useContext(Context);
  if (!context) throw new Error('AppearanceProvider is required');
  const { preferences } = context;
  const palette = {
    background: preferences.dark ? '#15171b' : '#f8fafd',
    surface: preferences.dark ? '#22252b' : '#ffffff',
    text: preferences.dark ? '#edf0f5' : '#202124',
    muted: preferences.dark ? '#a6adb8' : '#80868b',
    border: preferences.dark ? '#3a4049' : '#e7ebf0',
  };
  return { ...context, ...palette };
}
export function useSectionStyles<T>(factory: (color: (value: string) => string) => T, section: 'tasks' | 'habits' | 'agenda') {
  const appearance = useAppearance();
  const { preferences, background, surface, text, muted, border } = appearance;
  const accent = preferences[section];
  const soft = `${accent}${preferences.dark ? '26' : '18'}`;
  const color = useCallback((value: string) => {
    if (['#1a73e8', '#185abc', '#188038', '#34a853'].includes(value)) return accent;
    if (['#e8f0fe', '#e6f4ea', '#d7efdf', '#edf2fa', '#edf3fd', '#f0f5ff'].includes(value)) return soft;
    if (value === '#f8fafd') return background;
    if (['#fff', '#ffffff'].includes(value)) return surface;
    if (['#202124', '#253c2d', '#34483a', '#3c4043', '#46534a'].includes(value)) return text;
    if (['#f1f4f2', '#f3f6f4'].includes(value)) return preferences.dark ? '#2c3037' : value;
    if (['#edf0f5', '#edf0f3', '#f0f2f5', '#e7eee9', '#e1e5ea', '#c8d9cd', '#a9cbb3', '#a8b1be', '#c2d3ed'].includes(value)) return border;
    if (['#80868b', '#9aa0a6', '#5f6368', '#69766d', '#89958d', '#748078', '#7c8980', '#808b83', '#9299a3', '#727780', '#8b919b', '#6c7d96'].includes(value)) return muted;
    return value;
  }, [accent, soft, background, surface, text, muted, border, preferences.dark]);
  const styles = useMemo(() => factory(color), [factory, color]);
  return { ...appearance, accent, soft, color, styles };
}
