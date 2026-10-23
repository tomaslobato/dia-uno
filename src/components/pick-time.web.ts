function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Opens the browser's local time picker. */
export function pickTime(value: Date, onPick: (date: Date) => void): boolean {
  const input = document.createElement('input');
  input.type = 'time';
  input.value = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  input.style.position = 'fixed';
  input.style.left = '0';
  input.style.top = '0';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  input.style.width = '0';
  input.style.height = '0';
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
