import { defineConfig, devices } from '@playwright/test';

const isElectron = process.env.PW_TEST_MODE === 'electron';

export default defineConfig({
  testDir: './tests',
  testMatch: isElectron ? /integration\/.*\.spec\.ts$/ : /e2e\/.*\.spec\.ts$/,
  timeout: 30000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: isElectron
    ? [
        {
          name: 'electron',
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : undefined,
  webServer: isElectron
    ? undefined
    : {
        command: 'npx vite --port 5173 --strictPort',
        port: 5173,
        reuseExistingServer: true,
        timeout: 30000,
      },
});