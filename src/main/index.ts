import { app, BrowserWindow, shell } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc/index.js';

// 测试钩子：通过环境变量注入 mock LLM，避免集成测试命中真实网络
if (process.env.OPENSTUDY_MOCK_LLM) {
  const url = process.env.OPENSTUDY_MOCK_LLM;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url && u.startsWith(url)) {
      // 默认按 OpenAI 协议返回；如果测试需要其他协议，可以扩展
      const body = JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                questions: [
                  {
                    type: 'choice',
                    stem: '集成测试题目（来自 mock LLM）',
                    options: ['A. 选项 1', 'B. 选项 2'],
                    answer: 'A',
                    explanation: 'mocked',
                  },
                ],
              }),
            },
          },
        ],
      });
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
}

let mainWindow: BrowserWindow | null = null;

function getAppIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'app_icon.png');
  }

  const candidates = [
    join(app.getAppPath(), 'public', 'app_icon.png'),
    join(app.getAppPath(), '..', '..', 'public', 'app_icon.png'),
    join(process.cwd(), 'public', 'app_icon.png'),
    join(app.getAppPath(), 'resources', 'app_icon.png'),
    join(app.getAppPath(), '..', '..', 'resources', 'app_icon.png'),
    join(process.cwd(), 'resources', 'app_icon.png'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return candidates[candidates.length - 1];
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'OpenStudy',
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.on('preload-error', (_e, p, err) => {
    // eslint-disable-next-line no-console
    console.error('[preload-error]', p, err);
  });
  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    // eslint-disable-next-line no-console
    console.log(`[renderer ${level}] ${source}:${line} ${message}`);
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    if (process.env.OPEN_DEVTOOLS) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.setIcon(getAppIconPath());
  }
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
