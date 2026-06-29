export type ShortcutActionKey =
  | 'practiceSubmit'
  | 'practiceNext'
  | 'practicePrev'
  | 'practiceOptionPrev'
  | 'practiceOptionNext';

export interface ShortcutBinding {
  key: string;
  mod?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
}

export interface ShortcutSettings {
  practiceSubmit: ShortcutBinding;
  practiceNext: ShortcutBinding;
  practicePrev: ShortcutBinding;
  practiceOptionPrev: ShortcutBinding;
  practiceOptionNext: ShortcutBinding;
}

export const DEFAULT_SHORTCUTS: ShortcutSettings = {
  practiceSubmit: { key: 'Enter' },
  practiceNext: { key: 'Enter' },
  practicePrev: { key: 'ArrowLeft' },
  practiceOptionPrev: { key: 'ArrowUp' },
  practiceOptionNext: { key: 'ArrowDown' },
};

const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  spacebar: 'Space',
  esc: 'Escape',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  del: 'Delete',
  return: 'Enter',
};

export function normalizeShortcutKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  const alias = KEY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  if (trimmed.length === 1) return trimmed.toUpperCase();
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

export function normalizeShortcutBinding(
  binding: Partial<ShortcutBinding> | null | undefined,
  fallback: ShortcutBinding,
): ShortcutBinding {
  const key = normalizeShortcutKey(binding?.key);
  if (!key) return { ...fallback };
  return {
    key,
    ...(binding?.mod ? { mod: true } : {}),
    ...(binding?.ctrl ? { ctrl: true } : {}),
    ...(binding?.meta ? { meta: true } : {}),
    ...(binding?.alt ? { alt: true } : {}),
    ...(binding?.shift ? { shift: true } : {}),
  };
}

export function normalizeShortcutSettings(
  shortcuts: Partial<ShortcutSettings> | null | undefined,
): ShortcutSettings {
  return {
    practiceSubmit: normalizeShortcutBinding(
      shortcuts?.practiceSubmit,
      DEFAULT_SHORTCUTS.practiceSubmit,
    ),
    practiceNext: normalizeShortcutBinding(shortcuts?.practiceNext, DEFAULT_SHORTCUTS.practiceNext),
    practicePrev: normalizeShortcutBinding(shortcuts?.practicePrev, DEFAULT_SHORTCUTS.practicePrev),
    practiceOptionPrev: normalizeShortcutBinding(
      shortcuts?.practiceOptionPrev,
      DEFAULT_SHORTCUTS.practiceOptionPrev,
    ),
    practiceOptionNext: normalizeShortcutBinding(
      shortcuts?.practiceOptionNext,
      DEFAULT_SHORTCUTS.practiceOptionNext,
    ),
  };
}
