export type TimePickerAnchor = { x: number; y: number };

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Reads click coordinates from a Pressable event (web). */
export function timePickerAnchorFromEvent(event?: {
  nativeEvent?: { clientX?: number; clientY?: number; pageX?: number; pageY?: number };
  currentTarget?: { getBoundingClientRect?: () => DOMRect };
}): TimePickerAnchor | undefined {
  const native = event?.nativeEvent;
  if (native) {
    if (typeof native.clientX === 'number' && typeof native.clientY === 'number' && Number.isFinite(native.clientX) && Number.isFinite(native.clientY)) {
      return { x: native.clientX, y: native.clientY };
    }
    if (typeof native.pageX === 'number' && typeof native.pageY === 'number' && Number.isFinite(native.pageX) && Number.isFinite(native.pageY)) {
      return { x: native.pageX - (window.scrollX || 0), y: native.pageY - (window.scrollY || 0) };
    }
  }
  const rect = event?.currentTarget?.getBoundingClientRect?.();
  if (!rect) return undefined;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Opens the browser's local time picker anchored near the press point. */
export function pickTime(value: Date, onPick: (date: Date) => void, anchor?: TimePickerAnchor): boolean {
  const input = document.createElement('input');
  input.type = 'time';
  input.value = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  const size = 44;
  const x = anchor ? Math.max(0, Math.min(anchor.x - size / 2, window.innerWidth - size)) : 0;
  const y = anchor ? Math.max(0, Math.min(anchor.y - size / 2, window.innerHeight - size)) : 0;
  input.style.position = 'fixed';
  input.style.left = `${x}px`;
  input.style.top = `${y}px`;
  input.style.width = `${size}px`;
  input.style.height = `${size}px`;
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  input.style.border = '0';
  input.style.padding = '0';
  input.style.margin = '0';
  input.style.zIndex = '-1';
  const finish = (selected: Date | null) => {
    input.remove();
    if (selected) onPick(selected);
  };
  input.addEventListener('change', () => {
    if (!input.value) {
      finish(null);
      return;
    }
    const [hours, minutes] = input.value.split(':').map(Number);
    const next = new Date(value);
    next.setHours(hours, minutes, 0, 0);
    finish(next);
  });
  input.addEventListener('cancel', () => finish(null));
  document.body.appendChild(input);
  if (typeof input.showPicker === 'function') input.showPicker();
  else input.click();
  return false;
}
