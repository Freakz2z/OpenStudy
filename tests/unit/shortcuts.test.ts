import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  normalizeShortcutBinding,
  normalizeShortcutKey,
  normalizeShortcutSettings,
} from '../../src/shared/shortcuts';

describe('shortcuts', () => {
  it('normalizes shortcut keys and aliases', () => {
    expect(normalizeShortcutKey('s')).toBe('S');
    expect(normalizeShortcutKey(' left ')).toBe('ArrowLeft');
    expect(normalizeShortcutKey(' ')).toBe('Space');
    expect(normalizeShortcutKey('spacebar')).toBe('Space');
    expect(normalizeShortcutKey('')).toBeNull();
  });

  it('falls back to defaults when binding key is invalid', () => {
    expect(normalizeShortcutBinding({ key: '' }, DEFAULT_SHORTCUTS.practiceSubmit)).toEqual(
      DEFAULT_SHORTCUTS.practiceSubmit,
    );
  });

  it('fills missing shortcut settings from defaults', () => {
    expect(
      normalizeShortcutSettings({
        practiceSubmit: { key: 'space' },
      }),
    ).toEqual({
      ...DEFAULT_SHORTCUTS,
      practiceSubmit: { key: 'Space' },
    });
  });
});
