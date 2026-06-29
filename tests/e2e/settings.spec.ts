import { test, expect } from '@playwright/test';
import { installApiMock } from './_helpers';
import { DEFAULT_SHORTCUTS } from '../../src/shared/shortcuts';

test.describe('Models 页面', () => {
  test('DeepSeek 选项存在且排在第一', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/models');
    const select = page.locator('.settings-model-card select').first();
    const options = await select.locator('option').allTextContents();
    expect(options[0]).toContain('DeepSeek');
    expect(options.some((o) => o.includes('OpenAI'))).toBe(true);
    expect(options.some((o) => o.includes('Anthropic'))).toBe(true);
    expect(options.some((o) => o.includes('Ollama'))).toBe(true);
  });

  test('默认显示 DeepSeek provider 的表单（首次启动）', async ({ page }) => {
    // 模拟空 settings：首次启动
    await installApiMock(page, {
      settings: {
        llm: {
          provider: 'deepseek',
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
        },
        shortcuts: DEFAULT_SHORTCUTS,
      },
    });
    await page.goto('/#/models');
    const select = page.locator('.settings-model-card select').first();
    await expect(select).toHaveValue('deepseek');
    await expect(page.locator('input[placeholder="https://api.deepseek.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder="deepseek-v4-flash"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('老的 openai 设置仍能正常加载', async ({ page }) => {
    await installApiMock(page, {
      settings: {
        llm: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
        shortcuts: DEFAULT_SHORTCUTS,
      },
    });
    await page.goto('/#/models');
    const select = page.locator('.settings-model-card select').first();
    await expect(select).toHaveValue('openai');
    await expect(page.locator('input[placeholder="https://api.openai.com/v1"]')).toBeVisible();
    await expect(page.locator('input[placeholder="gpt-4o-mini"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('切到 ollama 时隐藏 API Key', async ({ page }) => {
    await installApiMock(page, {
      settings: {
        llm: {
          provider: 'deepseek',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
          apiKey: 'sk-test',
        },
        shortcuts: DEFAULT_SHORTCUTS,
      },
    });
    await page.goto('/#/models');
    await page.locator('.settings-model-card select').first().selectOption('ollama');
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('点保存后调用 updateSettings 并显示「已保存」', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/models');
    await page.locator('.settings-model-card button[aria-label="保存"]').click();
    await expect(page.locator('.settings-model-card .panel-status')).toHaveText('已保存');
    const saved = await page.evaluate(
      () => (window as unknown as { __lastSavedSettings?: unknown }).__lastSavedSettings,
    );
    expect(saved).toBeTruthy();
  });

  test('设置 DeepSeek 后保存字段正确', async ({ page }) => {
    let persistedSettings: unknown = null;
    await page.exposeFunction('__persist', (s: unknown) => {
      persistedSettings = s;
    });
    await installApiMock(page, {
      overrides: {
        updateSettings: `async (s) => { await window.__persist(s); return s; }`,
      },
    });
    await page.goto('/#/models');
    await page.locator('.settings-model-card select').first().selectOption('deepseek');
    await page.locator('input[type="password"]').fill('sk-deepseek-test');
    await page.locator('.settings-model-card button[aria-label="保存"]').click();
    await expect(page.locator('.settings-model-card .panel-status')).toHaveText('已保存');
    expect(persistedSettings).toMatchObject({
      llm: {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
        apiKey: 'sk-deepseek-test',
      },
    });
  });

  test('外观按钮横向排列，语言使用下拉框', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/settings');

    const themeButtons = page.locator('.settings-theme-options .segmented-option');
    await expect(themeButtons).toHaveCount(3);
    await expect(page.locator('.settings-language-field select')).toBeVisible();
    await expect(page.locator('.settings-language-field select')).toHaveValue('zh');

    const boxes = await themeButtons.evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).getBoundingClientRect().top),
    );
    expect(new Set(boxes.map((value) => Math.round(value))).size).toBe(1);

    const options = await page
      .locator('.settings-language-field select option')
      .allTextContents();
    expect(options).toEqual(['简体中文', 'English']);
  });

  test('设置页只展示做题相关快捷键，不展示保存相关快捷键', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/settings');

    await expect(page.locator('.settings-shortcut-row')).toHaveCount(6);
    await expect(page.getByText('查看答案')).toBeVisible();
    await expect(page.getByText('保存当前题')).toHaveCount(0);
    await expect(page.getByText('全部保存')).toHaveCount(0);
  });
});
