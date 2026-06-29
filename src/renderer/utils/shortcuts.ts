import type { ShortcutBinding } from '@shared/shortcuts';
import { normalizeShortcutKey } from '@shared/shortcuts';

const IS_MAC =
  typeof navigator !== 'undefined' && /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform);

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift']);

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Escape: 'Esc',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Space: 'Space',
};

export function eventToShortcutBinding(event: KeyboardEvent): ShortcutBinding | null {
  const key = normalizeShortcutKey(event.key);
  if (!key || MODIFIER_KEYS.has(key)) return null;
  const primaryModifierPressed = IS_MAC ? event.metaKey : event.ctrlKey;
  return {
    key,
    ...(primaryModifierPressed ? { mod: true } : {}),
    ...(IS_MAC
      ? (event.ctrlKey ? { ctrl: true } : {})
      : (event.metaKey ? { meta: true } : {})),
    ...(event.altKey ? { alt: true } : {}),
    ...(event.shiftKey ? { shift: true } : {}),
  };
}

export function formatShortcut(binding: ShortcutBinding): string {
  const labels: string[] = [];
  if (binding.mod) labels.push(IS_MAC ? 'Cmd' : 'Ctrl');
  if (binding.ctrl) labels.push('Ctrl');
  if (binding.meta) labels.push('Cmd');
  if (binding.alt) labels.push(IS_MAC ? 'Option' : 'Alt');
  if (binding.shift) labels.push('Shift');
  labels.push(KEY_LABELS[binding.key] ?? binding.key);
  return labels.join('+');
}

export function matchesShortcut(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  const key = normalizeShortcutKey(event.key);
  if (!key || key !== binding.key) return false;

  const expectedCtrl = Boolean(binding.ctrl || (binding.mod && !IS_MAC));
  const expectedMeta = Boolean(binding.meta || (binding.mod && IS_MAC));
  const expectedAlt = Boolean(binding.alt);
  const expectedShift = Boolean(binding.shift);

  return (
    event.ctrlKey === expectedCtrl &&
    event.metaKey === expectedMeta &&
    event.altKey === expectedAlt &&
    event.shiftKey === expectedShift
  );
}
