/* eslint-disable react-hooks/refs -- drag slot animated values and pan responders close over refs by design */
import { useSectionStyles } from '@/theme/appearance';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { Task } from '@/models/task';

export type DateTaskSection = {
  title: string;
  day: string | null;
  tasks: Task[];
};

type DragApi = {
  isDragging: boolean;
  showHandle: boolean;
  onLongPressReorder?: () => void;
  onReorderPressOut?: () => void;
};

type FlatItem =
  | { kind: 'header'; key: string; title: string; day: string | null }
  | { kind: 'task'; key: string; id: string; day: string | null };

type Props = {
  sections: DateTaskSection[];
  enabled: boolean;
  onMoveToDay: (taskId: string, day: string | null) => void;
  onDraggingChange?: (dragging: boolean) => void;
  onSectionPress?: (title: string) => void;
  selectedTitle?: string | null;
  fadingOutTitles?: Set<string> | string[];
  titleStyle: TextStyle;
  selectedTitleStyle?: TextStyle;
  renderItem: (task: Task, index: number, drag: DragApi) => ReactElement;
};

const FALLBACK_HEIGHT = 64;
const FALLBACK_HEADER = 28;

function flatten(sections: DateTaskSection[]): FlatItem[] {
  const items: FlatItem[] = [];
  for (const section of sections) {
    items.push({ kind: 'header', key: `h:${section.title}`, title: section.title, day: section.day });
    for (const task of section.tasks) {
      items.push({ kind: 'task', key: `t:${task.id}`, id: task.id, day: section.day });
    }
  }
  return items;
}

function itemsSignature(items: FlatItem[]) {
  return items.map((item) => `${item.key}:${item.kind === 'task' ? item.day ?? 'null' : item.day ?? 'null'}`).join('|');
}

function moveTask(items: FlatItem[], from: number, to: number): FlatItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  if (items[from]?.kind !== 'task') return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  let insertAt = to > from ? to - 1 : to;
  if (next[insertAt]?.kind === 'header') insertAt += 1;
  if (insertAt === 0 && next[0]?.kind === 'header') insertAt = 1;
  next.splice(Math.min(insertAt, next.length), 0, item);
  return next;
}

function dayAbove(items: FlatItem[], index: number): string | null | undefined {
  for (let i = index; i >= 0; i -= 1) {
    const item = items[i];
    if (item?.kind === 'header') return item.day;
  }
  return undefined;
}

function withUpdatedTaskDay(items: FlatItem[], taskKey: string, day: string | null): FlatItem[] {
  return items.map((item) => (item.kind === 'task' && item.key === taskKey ? { ...item, day } : item));
}

function hoverIndexFromDy(from: number, dy: number, keys: string[], heights: Record<string, number>) {
  let index = from;
  let remaining = dy;
  if (remaining >= 0) {
    while (index < keys.length - 1) {
      const nextKey = keys[index + 1];
      const step = heights[nextKey] || (nextKey.startsWith('h:') ? FALLBACK_HEADER : FALLBACK_HEIGHT);
      if (remaining < step * 0.55) break;
      remaining -= step;
      index += 1;
    }
  } else {
    while (index > 0) {
      const prevKey = keys[index - 1];
      const step = heights[prevKey] || (prevKey.startsWith('h:') ? FALLBACK_HEADER : FALLBACK_HEIGHT);
      if (-remaining < step * 0.55) break;
      remaining += step;
      index -= 1;
    }
  }
  return index;
}

function siblingShift(index: number, from: number, hover: number, dragHeight: number) {
  if (from < hover && index > from && index <= hover) return -dragHeight;
  if (from > hover && index >= hover && index < from) return dragHeight;
  return 0;
}

export default function DraggableDateTaskList({
  sections,
  enabled,
  onMoveToDay,
  onDraggingChange,
  onSectionPress,
  selectedTitle,
  fadingOutTitles,
  titleStyle,
  selectedTitleStyle,
  renderItem,
}: Props) {
  const { styles } = useSectionStyles(makeStyles, 'tasks');
  const fading = useMemo(() => (
    fadingOutTitles instanceof Set ? fadingOutTitles : new Set(fadingOutTitles ?? [])
  ), [fadingOutTitles]);
  const sourceItems = useMemo(() => flatten(sections), [sections]);
  const sourceKey = itemsSignature(sourceItems);
  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const section of sections) {
      for (const task of section.tasks) map.set(task.id, task);
    }
    return map;
  }, [sections]);

  const [items, setItems] = useState(sourceItems);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState(0);
  const heights = useRef<Record<string, number>>({});
  const fromIndex = useRef(0);
  const hoverRef = useRef(0);
  const itemsRef = useRef(items);
  const draggingRef = useRef<string | null>(null);
  const panActiveRef = useRef(false);
  const onMoveToDayRef = useRef(onMoveToDay);
  const dragY = useRef(new Animated.Value(0)).current;
  const slotY = useRef<Record<string, Animated.Value>>({});
  const fadeOpacity = useRef<Record<string, Animated.Value>>({});
  const keys = items.map((item) => item.key);
  const keysKey = keys.join('|');

  onMoveToDayRef.current = onMoveToDay;

  for (const key of keys) {
    if (!slotY.current[key]) slotY.current[key] = new Animated.Value(0);
  }
  for (const section of sections) {
    if (!fadeOpacity.current[section.title]) fadeOpacity.current[section.title] = new Animated.Value(1);
  }

  useEffect(() => {
    for (const section of sections) {
      const value = fadeOpacity.current[section.title];
      if (!value) continue;
      Animated.timing(value, {
        toValue: fading.has(section.title) ? 0 : 1,
        duration: fading.has(section.title) ? 200 : 220,
        easing: Easing.out(Easing.cubic),
        // Must stay on the JS driver: the same rows also animate translateY while dragging.
        useNativeDriver: false,
      }).start();
    }
  }, [fading, sections]);

  useEffect(() => {
    if (draggingKey) return;
    // Sync local order with upstream sections when not mid-drag.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional projection sync
    setItems(sourceItems);
  }, [sourceKey, draggingKey, sourceItems]);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => {
    draggingRef.current = draggingKey;
    onDraggingChange?.(Boolean(draggingKey));
  }, [draggingKey, onDraggingChange]);

  useEffect(() => {
    if (!draggingKey) {
      for (const key of keys) slotY.current[key]?.setValue(0);
      return;
    }
    const dragHeight = heights.current[draggingKey] || FALLBACK_HEIGHT;
    const from = fromIndex.current;
    const animations = keys.flatMap((key, index) => {
      if (key === draggingKey) return [];
      // Hoy may slide up when past-day tasks move through it, but never down.
      let target = siblingShift(index, from, hoverIndex, dragHeight);
      if (key === 'h:Hoy' && target > 0) target = 0;
      return [Animated.spring(slotY.current[key], { toValue: target, speed: 48, bounciness: 0, useNativeDriver: false })];
    });
    if (animations.length) Animated.parallel(animations).start();
  }, [draggingKey, hoverIndex, keysKey, keys]);

  function beginDrag(key: string) {
    if (!enabled || draggingRef.current) return;
    const index = itemsRef.current.findIndex((item) => item.key === key);
    if (index < 0 || itemsRef.current[index]?.kind !== 'task') return;
    fromIndex.current = index;
    hoverRef.current = index;
    panActiveRef.current = false;
    dragY.setValue(0);
    setHoverIndex(index);
    setDraggingKey(key);
  }

  function finishDrag(commit: boolean) {
    const key = draggingRef.current;
    if (!key) return;
    const current = itemsRef.current;
    const from = fromIndex.current;
    const hover = hoverRef.current;
    let next = commit ? moveTask(current, from, hover) : sourceItems;
    if (commit && from !== hover) {
      const movedIndex = next.findIndex((item) => item.key === key);
      const moved = next[movedIndex];
      if (moved?.kind === 'task') {
        const origin = current[from];
        const originDay = origin?.kind === 'task' ? origin.day : undefined;
        const targetDay = dayAbove(next, movedIndex);
        if (targetDay !== undefined && targetDay !== originDay) {
          next = withUpdatedTaskDay(next, key, targetDay);
          onMoveToDayRef.current(moved.id, targetDay);
        }
      }
    }
    itemsRef.current = next;
    setItems(next);
    panActiveRef.current = false;
    dragY.setValue(0);
    setDraggingKey(null);
    setHoverIndex(0);
  }

  function releaseIfIdle() {
    setTimeout(() => {
      if (draggingRef.current && !panActiveRef.current) finishDrag(true);
    }, 40);
  }

  function applyMove(dy: number) {
    if (!draggingRef.current) return;
    dragY.setValue(dy);
    const list = itemsRef.current;
    const from = fromIndex.current;
    let next = hoverIndexFromDy(from, dy, list.map((item) => item.key), heights.current);
    // Tasks in Hoy or below cannot be dragged above the Hoy section.
    const hoy = list.findIndex((item) => item.key === 'h:Hoy');
    if (hoy >= 0 && from >= hoy && next < hoy) next = hoy;
    if (next === hoverRef.current) return;
    hoverRef.current = next;
    setHoverIndex(next);
  }

  const movePan = useMemo(() => {
    const responders: Record<string, ReturnType<typeof PanResponder.create>> = {};
    for (const item of items) {
      if (item.kind !== 'task') continue;
      const key = item.key;
      responders[key] = PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => (
          enabled && draggingRef.current === key && Math.abs(gesture.dy) > 2
        ),
        onMoveShouldSetPanResponderCapture: (_, gesture) => (
          enabled && draggingRef.current === key && Math.abs(gesture.dy) > 2
        ),
        onPanResponderGrant: () => { panActiveRef.current = true; },
        onPanResponderTerminationRequest: () => draggingRef.current !== key,
        onPanResponderMove: (_, gesture) => {
          if (draggingRef.current !== key) return;
          applyMove(gesture.dy);
        },
        onPanResponderRelease: () => finishDrag(Boolean(draggingRef.current)),
        onPanResponderTerminate: () => finishDrag(false),
      });
    }
    return responders;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keysKey, sourceKey]);

  function onRowLayout(key: string, event: LayoutChangeEvent) {
    heights.current[key] = event.nativeEvent.layout.height;
  }

  return (
    <View>
      {items.map((item, rowIndex) => {
        if (item.kind === 'header') {
          const selected = selectedTitle === item.title;
          const fadingOut = fading.has(item.title);
          const spaced = rowIndex > 0;
          const next = items[rowIndex + 1];
          const emptyHoy = item.title === 'Hoy' && (!next || next.kind === 'header');
          return (
            <Animated.View
              key={item.key}
              onLayout={(event) => onRowLayout(item.key, event)}
              pointerEvents={fadingOut || draggingKey ? 'none' : 'auto'}
              style={[
                styles.headerWrap,
                spaced ? styles.headerSpaced : null,
                {
                  opacity: fadeOpacity.current[item.title] ?? 1,
                  transform: [{ translateY: slotY.current[item.key] ?? 0 }],
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selected ? `${item.title}, filtrado` : item.title}
                accessibilityHint={selected ? 'Toca de nuevo para ver todos los días' : 'Mostrar solo las tareas de este día'}
                accessibilityState={{ selected }}
                onPress={() => onSectionPress?.(item.title)}
                style={styles.header}
              >
                <Text accessibilityRole="header" style={[titleStyle, selected && selectedTitleStyle]}>{item.title}</Text>
              </Pressable>
              {emptyHoy ? <Text style={styles.emptyHoy}>No hay tareas para hoy</Text> : null}
            </Animated.View>
          );
        }

        const task = tasksById.get(item.id);
        if (!task) return null;
        const isDragging = draggingKey === item.key;
        const sectionTitle = (() => {
          for (let i = rowIndex; i >= 0; i -= 1) {
            const row = items[i];
            if (row?.kind === 'header') return row.title;
          }
          return '';
        })();
        const fadingOut = fading.has(sectionTitle);
        return (
          <Animated.View
            key={item.key}
            onLayout={(event) => onRowLayout(item.key, event)}
            pointerEvents={fadingOut ? 'none' : 'auto'}
            {...(enabled ? movePan[item.key]?.panHandlers ?? {} : {})}
            style={{
              opacity: fadeOpacity.current[sectionTitle] ?? 1,
              zIndex: isDragging ? 5 : 0,
              elevation: isDragging ? 6 : 0,
            }}
          >
            <Animated.View
              style={{
                opacity: isDragging ? 0.96 : 1,
                transform: isDragging
                  ? [{ translateY: dragY }, { scale: 1.015 }]
                  : [{ translateY: slotY.current[item.key] ?? 0 }],
              }}
            >
              {renderItem(task, rowIndex, {
                isDragging,
                showHandle: false,
                onLongPressReorder: enabled ? () => beginDrag(item.key) : undefined,
                onReorderPressOut: enabled ? releaseIfIdle : undefined,
              })}
            </Animated.View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const makeStyles = (color: (value: string) => string) => StyleSheet.create({
  headerWrap: { marginBottom: 0 },
  headerSpaced: { marginTop: 12 },
  header: { alignSelf: 'flex-start', paddingVertical: 2, paddingRight: 12 },
  emptyHoy: {
    marginLeft: 24,
    marginTop: 2,
    marginBottom: 8,
    fontFamily: 'Manrope-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: color('#9aa0a6'),
  },
});
