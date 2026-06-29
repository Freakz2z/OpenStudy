import { describe, expect, it } from 'vitest';
import { resolveAppDataDir, resolveUserDataDirArg } from '../../src/main/services/runtime-paths';

describe('runtime paths', () => {
  it('reads user data dir from --user-data-dir=...', () => {
    expect(resolveUserDataDirArg(['node', 'app', '--user-data-dir=/tmp/openstudy-a'])).toBe(
      '/tmp/openstudy-a',
    );
  });

  it('reads user data dir from --user-data-dir <path>', () => {
    expect(resolveUserDataDirArg(['node', 'app', '--user-data-dir', '/tmp/openstudy-b'])).toBe(
      '/tmp/openstudy-b',
    );
  });

  it('returns null when --user-data-dir has no value', () => {
    expect(resolveUserDataDirArg(['node', 'app', '--user-data-dir'])).toBeNull();
  });

  it('prefers cli user data dir over environment override', () => {
    const previous = process.env.OPENSTUDY_DATA_DIR;
    process.env.OPENSTUDY_DATA_DIR = '/tmp/from-env';
    try {
      expect(resolveAppDataDir(['node', 'app', '--user-data-dir=/tmp/from-cli'])).toBe(
        '/tmp/from-cli',
      );
    } finally {
      if (previous === undefined) delete process.env.OPENSTUDY_DATA_DIR;
      else process.env.OPENSTUDY_DATA_DIR = previous;
    }
  });
});
