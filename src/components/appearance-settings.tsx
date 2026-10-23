import Pressable from '@/components/feedback-pressable';
import { colorChoices, useAppearance, type NavSection } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

const navLabels: Record<NavSection, string> = {
  tasks: 'Tareas',
  habits: 'Hábitos',
  agenda: 'Agenda',
};

const ROW_HEIGHT = 52;

function moveItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function AppearanceSettings() {
  const { preferences, themeMode, setThemeMode, setShowGreetings, setNavOrder, update, ready, error, text, muted, border, surface } = useAppearance();
  const [order, setOrder] = useState(preferences.navOrder);
  const [dragging, setDragging] = useState<NavSection | null>(null);
  const [shiftY, setShiftY] = useState(0);
  const orderRef = useRef(order);
  const draggingRef = useRef<NavSection | null>(null);
  const startIndex = useRef(0);
  const currentIndex = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dragging) return;
    setOrder(preferences.navOrder);
  }, [preferences.navOrder, dragging]);

  useEffect(() => { orderRef.current = order; }, [order]);
  useEffect(() => { draggingRef.current = dragging; }, [dragging]);
  useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }, []);

  function clearLongPress() {
    if (!longPressTimer.current) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function beginDrag(section: NavSection) {
    const index = orderRef.current.indexOf(section);
    if (index < 0) return;
    startIndex.current = index;
    currentIndex.current = index;
    setDragging(section);
    setShiftY(0);
  }

  function finishDrag(commit: boolean) {
    clearLongPress();
    if (draggingRef.current && commit) setNavOrder(orderRef.current);
    setDragging(null);
    setShiftY(0);
    if (!commit) setOrder(preferences.navOrder);
  }

  function applyMove(dy: number) {
    const section = draggingRef.current;
    if (!section) return;
    setShiftY(dy);
    const target = Math.max(0, Math.min(orderRef.current.length - 1, startIndex.current + Math.round(dy / ROW_HEIGHT)));
    if (target === currentIndex.current) return;
    const next = moveItem(orderRef.current, currentIndex.current, target);
    currentIndex.current = target;
    orderRef.current = next;
    setOrder(next);
    setShiftY(dy - (target - startIndex.current) * ROW_HEIGHT);
    startIndex.current = target;
  }

  const handlePan = useMemo(() => {
    const responders: Partial<Record<NavSection, ReturnType<typeof PanResponder.create>>> = {};
    for (const section of order) {
      responders[section] = PanResponder.create({
        onStartShouldSetPanResponder: () => ready,
        onMoveShouldSetPanResponder: () => ready,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          clearLongPress();
          longPressTimer.current = setTimeout(() => beginDrag(section), 140);
        },
        onPanResponderMove: (_, gesture) => {
          if (!draggingRef.current) {
            if (Math.abs(gesture.dy) > 6) {
              clearLongPress();
              beginDrag(section);
            } else return;
          }
          if (draggingRef.current !== section) return;
          applyMove(gesture.dy);
        },
        onPanResponderRelease: () => finishDrag(Boolean(draggingRef.current)),
        onPanResponderTerminate: () => finishDrag(false),
      });
    }
    return responders;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, order.join('|'), preferences.navOrder.join('|')]);

  return <View style={styles.content}>
    <Text accessibilityRole="header" style={[styles.personalization, { color: text }]}>Personalización</Text>
    <Text style={[styles.label, { color: muted }]}>Tema</Text>
    <View style={styles.themes}>{([['system', 'Sistema', 'brightness-auto'], ['light', 'Claro', 'light-mode'], ['dark', 'Oscuro', 'dark-mode']] as const).map(([mode, label, icon]) => <Pressable key={mode} disabled={!ready} accessibilityRole="radio" aria-checked={themeMode === mode} accessibilityState={{ checked: themeMode === mode }} accessibilityLabel={`Tema ${label.toLowerCase()}`} onPress={() => setThemeMode(mode)} style={[styles.theme, { borderColor: themeMode === mode ? preferences.tasks : border }]}><MaterialIcons name={icon} size={20} color={text} /><Text style={{ color: text }}>{label}</Text></Pressable>)}</View>
    {(['tasks', 'habits', 'agenda'] as const).map((section) => <View key={section} style={styles.group}><Text style={[styles.label, { color: muted }]}>Color de {navLabels[section]}</Text><View style={styles.swatches}>{colorChoices.map(({ name, value }) => <Pressable key={value} disabled={!ready} accessibilityRole="radio" accessibilityLabel={`${navLabels[section]}: ${name}`} aria-checked={preferences[section] === value} accessibilityState={{ checked: preferences[section] === value }} onPress={() => update({ [section]: value })} style={[styles.swatch, { backgroundColor: value }]}>{preferences[section] === value && <MaterialIcons name="check" size={22} color="#fff" />}</Pressable>)}</View></View>)}
    <View style={styles.group}>
      <Text style={[styles.label, { color: muted }]}>Frases de bienvenida</Text>
      <Pressable disabled={!ready} accessibilityRole="switch" accessibilityLabel="Mostrar frases en Tareas y Hábitos" accessibilityState={{ checked: preferences.showGreetings }} aria-checked={preferences.showGreetings} onPress={() => setShowGreetings(!preferences.showGreetings)} style={styles.toggleRow}>
        <Text style={[styles.toggleHint, { color: muted, flex: 1 }]}>Saludos al inicio de Tareas y Hábitos</Text>
        <View style={[styles.switchTrack, { backgroundColor: preferences.showGreetings ? preferences.tasks : border }]}>
          <View style={[styles.switchThumb, preferences.showGreetings && styles.switchThumbOn]} />
        </View>
      </Pressable>
    </View>
    <View style={styles.group}>
      <Text style={[styles.label, { color: muted }]}>Orden del menú</Text>
      <Text style={[styles.toggleHint, { color: muted }]}>Mantén y arrastra para reordenar. Ajustes queda al final.</Text>
      <View style={[styles.navList, { borderColor: border, backgroundColor: surface }]}>
        {order.map((section, index) => {
          const isDragging = dragging === section;
          return (
            <View
              key={section}
              style={[
                styles.navRow,
                index > 0 && !isDragging && { borderTopColor: border, borderTopWidth: StyleSheet.hairlineWidth },
                isDragging && [styles.navRowDragging, { backgroundColor: surface, borderColor: border, transform: [{ translateY: shiftY }] }],
              ]}
              {...(handlePan[section]?.panHandlers ?? {})}
              accessibilityRole="adjustable"
              accessibilityLabel={`${navLabels[section]}, posición ${index + 1} de ${order.length}. Mantén y arrastra para reordenar`}
            >
              <View style={[styles.navDot, { backgroundColor: preferences[section] }]} />
              <Text style={[styles.navLabel, { color: text }]}>{navLabels[section]}</Text>
              <MaterialIcons name="drag-indicator" size={22} color={muted} />
            </View>
          );
        })}
      </View>
    </View>
    {error && <Text style={styles.error}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 20 },
  personalization: { fontFamily: 'Manrope-SemiBold', fontSize: 18, marginTop: 4 },
  label: { fontFamily: 'Manrope-Medium', fontSize: 13, fontWeight: 'normal' },
  themes: { flexDirection: 'row', gap: 8 },
  theme: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 12, borderWidth: 2, borderRadius: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  toggleHint: { fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 19 },
  switchTrack: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  switchThumbOn: { alignSelf: 'flex-end' },
  group: { gap: 12, marginTop: 8 },
  navList: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: ROW_HEIGHT, paddingLeft: 14, paddingRight: 12 },
  navRowDragging: { zIndex: 2, elevation: 4, borderWidth: 1, borderRadius: 14, marginHorizontal: -1 },
  navDot: { width: 10, height: 10, borderRadius: 5 },
  navLabel: { flex: 1, fontFamily: 'Manrope-Medium', fontSize: 15 },
  swatches: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#d65c66' },
});
