import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';
type AccentPreferences = { tasks: string; habits: string; agenda: string };
type Preferences = AccentPreferences & { dark: boolean; showGreetings: boolean };
type AppearanceContext = {
  preferences: Preferences;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  setShowGreetings: (show: boolean) => void;
  update: (change: Partial<AccentPreferences>) => void;
  ready: boolean;
  error: string | null;
};
const defaultAccents: AccentPreferences = { tasks: '#1a73e8', habits: '#d65c66', agenda: '#bf4f91' };
const Context = createContext<AppearanceContext | null>(null);
const validThemeModes: ThemeMode[] = ['system', 'light', 'dark'];
const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value);

export function accentTextColor(accent: string, dark: boolean) {
  if (!dark || !isColor(accent)) return accent;
  const channels = accent.slice(1).match(/.{2}/g);
  if (!channels) return accent;
  // Lift colored labels on dark surfaces while keeping the chosen hue recognizable.
  return `#${channels.map((channel) => Math.round(parseInt(channel, 16) * 0.78 + 255 * 0.22).toString(16).padStart(2, '0')).join('')}`;
}

export const colorChoices = [
  { name: 'Rojo claro', value: '#d65c66' }, { name: 'Azul', value: '#1a73e8' },
  { name: 'Verde', value: '#188038' }, { name: 'Violeta', value: '#8755c5' },
  { name: 'Naranja', value: '#b96a24' }, { name: 'Rosa', value: '#bf4f91' },
];

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [showGreetings, setShowGreetings] = useState(true);
  const [accents, setAccents] = useState(defaultAccents);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writes = useRef(Promise.resolve());
  const dark = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';
  const preferences = useMemo(() => ({ ...accents, dark, showGreetings }), [accents, dark, showGreetings]);
  const update = useCallback((change: Partial<AccentPreferences>) => setAccents((current) => ({ ...current, ...change })), []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    const previous = root.style.colorScheme;
    root.style.colorScheme = dark ? 'dark' : 'light';
    return () => { root.style.colorScheme = previous; };
  }, [dark]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('tareas.appearance.v1').then((raw) => {
      if (!active) return;
      if (raw) {
        const stored = JSON.parse(raw);
        if (!isColor(stored.tasks) || !isColor(stored.habits) || (stored.agenda !== undefined && !isColor(stored.agenda))) throw new Error('Invalid preferences');
        const storedMode = stored.themeMode;
        if (storedMode !== undefined && !validThemeModes.includes(storedMode)) throw new Error('Invalid theme preference');
        if (storedMode === undefined && typeof stored.dark !== 'boolean') throw new Error('Invalid legacy theme preference');
        // Older preferences stored only a dark boolean. Keep an explicit dark choice;
        // old light defaults return to system mode so the new default follows the device.
        setThemeMode(storedMode ?? (stored.dark ? 'dark' : 'system'));
        if (typeof stored.showGreetings === 'boolean') setShowGreetings(stored.showGreetings);
        const agenda = stored.agenda === '#8755c5' || stored.agenda === '#188038' ? defaultAccents.agenda : stored.agenda ?? defaultAccents.agenda;
        setAccents({ ...defaultAccents, tasks: stored.tasks, habits: stored.habits, agenda });
      }
      setReady(true);
    }).catch(() => { if (active) setError('No pudimos cargar la apariencia. Volvé a abrir la app.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    writes.current = writes.current.then(() => AsyncStorage.setItem('tareas.appearance.v1', JSON.stringify({ themeMode, showGreetings, ...accents }))).then(() => setError(null)).catch(() => setError('No pudimos guardar la apariencia.'));
  }, [accents, ready, showGreetings, themeMode]);

  const value = useMemo(() => ({ preferences, themeMode, setThemeMode, setShowGreetings, update, ready, error }), [preferences, themeMode, update, ready, error]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppearance() {
  const context = useContext(Context);
  if (!context) throw new Error('AppearanceProvider is required');
  const { preferences } = context;
  const palette = {
    background: preferences.dark ? '#000000' : '#f8fafd',
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
  const accentText = accentTextColor(accent, preferences.dark);
  const soft = `${accent}${preferences.dark ? '26' : '18'}`;
  const color = useCallback((value: string) => {
    if (value === '#185abc') return accentText;
    if (['#1a73e8', '#188038', '#34a853'].includes(value)) return accent;
    if (['#e8f0fe', '#e6f4ea', '#d7efdf', '#edf2fa', '#edf3fd', '#f0f5ff'].includes(value)) return soft;
    if (value === '#f8fafd') return background;
    if (['#fff', '#ffffff'].includes(value)) return surface;
    if (['#202124', '#253c2d', '#34483a', '#3c4043', '#46534a'].includes(value)) return text;
    if (['#f1f4f2', '#f3f6f4'].includes(value)) return preferences.dark ? '#2c3037' : value;
    if (['#edf0f5', '#edf0f3', '#f0f2f5', '#e7eee9', '#e1e5ea', '#c8d9cd', '#a9cbb3', '#a8b1be', '#c2d3ed'].includes(value)) return border;
    if (['#80868b', '#9aa0a6', '#5f6368', '#69766d', '#89958d', '#748078', '#7c8980', '#808b83', '#9299a3', '#727780', '#8b919b', '#6c7d96'].includes(value)) return muted;
    return value;
  }, [accent, accentText, soft, background, surface, text, muted, border, preferences.dark]);
  const styles = useMemo(() => factory(color), [factory, color]);
  return { ...appearance, accent, accentText, soft, color, styles };
}
