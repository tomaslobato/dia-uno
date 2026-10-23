import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, View } from 'react-native';
import type { Task } from '@/models/task';

type Props = {
  tasks: Task[];
  enabled: boolean;
  onReorder: (ids: string[]) => void;
  onDraggingChange?: (dragging: boolean) => void;
  renderItem: (task: Task, index: number, last: boolean, drag: { isDragging: boolean; handleHandlers: object }) => ReactElement;
};

function moveId(list: string[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function DraggableTaskList({ tasks, enabled, onReorder, onDraggingChange, renderItem }: Props) {
  const [ids, setIds] = useState(() => tasks.map((task) => task.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [shiftY, setShiftY] = useState(0);
  const heights = useRef<Record<string, number>>({});
  const startIndex = useRef(0);
  const currentIndex = useRef(0);
  const idsRef = useRef(ids);
  const draggingRef = useRef<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const taskIdsKey = tasks.map((task) => task.id).join('|');

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

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function finishDrag(commit: boolean) {
    clearLongPress();
    if (draggingRef.current && commit) onReorder(idsRef.current);
    setDraggingId(null);
    setShiftY(0);
    if (!commit) setIds(tasks.map((task) => task.id));
  }

  function beginDrag(id: string) {
    const index = idsRef.current.indexOf(id);
    if (index < 0) return;
    startIndex.current = index;
    currentIndex.current = index;
    setDraggingId(id);
    setShiftY(0);
  }

  function applyMove(dy: number) {
    const id = draggingRef.current;
    if (!id) return;
    setShiftY(dy);
    const height = heights.current[id] || 64;
    const target = Math.max(0, Math.min(idsRef.current.length - 1, startIndex.current + Math.round(dy / height)));
    if (target === currentIndex.current) return;
    const next = moveId(idsRef.current, currentIndex.current, target);
    currentIndex.current = target;
    idsRef.current = next;
    setIds(next);
    setShiftY(dy - (target - startIndex.current) * height);
    startIndex.current = target;
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
          longPressTimer.current = setTimeout(() => beginDrag(id), 160);
        },
        onPanResponderMove: (_, gesture) => {
          if (!draggingRef.current) {
            if (Math.abs(gesture.dy) > 6) {
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
          <View
            key={id}
            onLayout={(event) => onRowLayout(id, event)}
            style={isDragging ? { transform: [{ translateY: shiftY }], zIndex: 5, elevation: 5 } : undefined}
          >
            {renderItem(task, index, index === ids.length - 1, {
              isDragging,
              handleHandlers: enabled ? handlePan[id]?.panHandlers ?? {} : {},
            })}
          </View>
        );
      })}
    </View>
  );
}
