import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const source = join(process.cwd(), 'public', 'app_icon.png');
const output = join(process.cwd(), 'resources', 'icon.icns');

if (process.platform !== 'darwin') {
  console.log('[generate-macos-icon] Skipped: current platform is not macOS.');
  process.exit(0);
}

if (!existsSync(source)) {
  console.error(`[generate-macos-icon] Source icon not found: ${source}`);
  process.exit(1);
}

const tempRoot = mkdtempSync(join(tmpdir(), 'openstudy-iconset-'));
const iconsetDir = join(tempRoot, 'OpenStudy.iconset');

mkdirSync(iconsetDir, { recursive: true });

const entries = [
  { size: 16, file: 'icon_16x16.png' },
  { size: 32, file: 'icon_16x16@2x.png' },
  { size: 32, file: 'icon_32x32.png' },
  { size: 64, file: 'icon_32x32@2x.png' },
  { size: 128, file: 'icon_128x128.png' },
  { size: 256, file: 'icon_128x128@2x.png' },
  { size: 256, file: 'icon_256x256.png' },
  { size: 512, file: 'icon_256x256@2x.png' },
  { size: 512, file: 'icon_512x512.png' },
  { size: 1024, file: 'icon_512x512@2x.png' },
];

try {
  for (const entry of entries) {
    execFileSync('sips', ['-z', String(entry.size), String(entry.size), source, '--out', join(iconsetDir, entry.file)], {
      stdio: 'pipe',
    });
  }

  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', output], { stdio: 'pipe' });
  console.log(`[generate-macos-icon] Wrote ${output}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
