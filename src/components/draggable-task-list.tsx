import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, View } from 'react-native';
import type { Task } from '@/models/task';

type Props = {
  tasks: Task[];
  enabled: boolean;
  onReorder: (ids: string[]) => void;
  onDraggingChange?: (dragging: boolean) => void;
  renderItem: (task: Task, index: number, drag: { isDragging: boolean; handleHandlers: object }) => ReactElement;
};

const FALLBACK_HEIGHT = 64;

function moveId(list: string[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function hoverIndexFromDy(from: number, dy: number, ids: string[], heights: Record<string, number>) {
  let index = from;
  let remaining = dy;
  if (remaining >= 0) {
    while (index < ids.length - 1) {
      const step = heights[ids[index + 1]] || FALLBACK_HEIGHT;
      if (remaining < step * 0.55) break;
      remaining -= step;
      index += 1;
    }
  } else {
    while (index > 0) {
      const step = heights[ids[index - 1]] || FALLBACK_HEIGHT;
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

export default function DraggableTaskList({ tasks, enabled, onReorder, onDraggingChange, renderItem }: Props) {
  const [ids, setIds] = useState(() => tasks.map((task) => task.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState(0);
  const heights = useRef<Record<string, number>>({});
  const fromIndex = useRef(0);
  const hoverRef = useRef(0);
  const idsRef = useRef(ids);
  const draggingRef = useRef<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const slotY = useRef<Record<string, Animated.Value>>({});
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const taskIdsKey = tasks.map((task) => task.id).join('|');

  for (const id of ids) {
    if (!slotY.current[id]) slotY.current[id] = new Animated.Value(0);
  }

  useEffect(() => {
    if (draggingId) return;
    setIds(tasks.map((task) => task.id));
  }, [taskIdsKey, draggingId, tasks]);

  useEffect(() => { idsRef.current = ids; }, [ids]);
  useEffect(() => {
    draggingRef.current = draggingId;
    onDraggingChange?.(Boolean(draggingId));
  }, [draggingId, onDraggingChange]);

  useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }, []);

  useEffect(() => {
    if (!draggingId) {
      for (const id of ids) slotY.current[id]?.setValue(0);
      return;
    }
    const dragHeight = heights.current[draggingId] || FALLBACK_HEIGHT;
    const from = fromIndex.current;
    const animations = ids.flatMap((id, index) => {
      if (id === draggingId) return [];
      const target = siblingShift(index, from, hoverIndex, dragHeight);
      return [Animated.spring(slotY.current[id], { toValue: target, speed: 48, bounciness: 0, useNativeDriver: false })];
    });
    if (animations.length) Animated.parallel(animations).start();
  }, [draggingId, hoverIndex, ids]);

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function beginDrag(id: string) {
    if (draggingRef.current) return;
    const index = idsRef.current.indexOf(id);
    if (index < 0) return;
    fromIndex.current = index;
    hoverRef.current = index;
    dragY.setValue(0);
    setHoverIndex(index);
    setDraggingId(id);
  }

  function finishDrag(commit: boolean) {
    clearLongPress();
    const id = draggingRef.current;
    if (!id) return;
    const next = commit ? moveId(idsRef.current, fromIndex.current, hoverRef.current) : tasks.map((task) => task.id);
    idsRef.current = next;
    setIds(next);
    if (commit && fromIndex.current !== hoverRef.current) onReorder(next);
    dragY.setValue(0);
    setDraggingId(null);
    setHoverIndex(0);
  }

  function applyMove(dy: number) {
    const id = draggingRef.current;
    if (!id) return;
    dragY.setValue(dy);
    const next = hoverIndexFromDy(fromIndex.current, dy, idsRef.current, heights.current);
    if (next === hoverRef.current) return;
    hoverRef.current = next;
    setHoverIndex(next);
  }

  const handlePan = useMemo(() => {
    const responders: Record<string, ReturnType<typeof PanResponder.create>> = {};
    for (const id of ids) {
      responders[id] = PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: () => enabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          clearLongPress();
          longPressTimer.current = setTimeout(() => beginDrag(id), 120);
        },
        onPanResponderMove: (_, gesture) => {
          if (!draggingRef.current) {
            if (Math.abs(gesture.dy) > 4) {
              clearLongPress();
              beginDrag(id);
            } else return;
          }
          if (draggingRef.current !== id) return;
          applyMove(gesture.dy);
        },
        onPanResponderRelease: () => finishDrag(Boolean(draggingRef.current)),
        onPanResponderTerminate: () => finishDrag(false),
      });
    }
    return responders;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ids.join('|'), taskIdsKey, onReorder, tasks]);

  function onRowLayout(id: string, event: LayoutChangeEvent) {
    heights.current[id] = event.nativeEvent.layout.height;
  }

  return (
    <View>
      {ids.map((id, index) => {
        const task = tasksById.get(id);
        if (!task) return null;
        const isDragging = draggingId === id;
        return (
          <Animated.View
            key={id}
            onLayout={(event) => onRowLayout(id, event)}
            style={isDragging
              ? { transform: [{ translateY: dragY }, { scale: 1.015 }], zIndex: 5, elevation: 6, opacity: 0.96 }
              : { transform: [{ translateY: slotY.current[id] ?? 0 }], zIndex: 0 }}
          >
            {renderItem(task, index, {
              isDragging,
              handleHandlers: enabled ? handlePan[id]?.panHandlers ?? {} : {},
            })}
          </Animated.View>
        );
      })}
    </View>
  );
}
