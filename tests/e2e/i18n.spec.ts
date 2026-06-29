import { test, expect } from '@playwright/test';
import { installApiMock } from './_helpers';

test.describe('i18n 语言切换', () => {
  test('Sidebar 中文 → 英文切换无错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await installApiMock(page);
    await page.goto('/');
    // 默认中文：title 显示「题库」
    await expect(page.getByRole('heading', { name: '题库' })).toBeVisible();
    // 语言切换统一收口在设置页
    await page.goto('/#/settings');
    await page.locator('.settings-language-field select').selectOption('en');
    await page.goto('/#/library');
    // 等待 i18n 切换完成
    await page.waitForTimeout(500);
    // 标题变成英文
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
    // 关键：没有 Maximum update depth 错误
    expect(errors.some((e) => e.includes('Maximum update depth'))).toBe(false);
  });

  test('语言切换后无 console 错误', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    await installApiMock(page);
    await page.goto('/');
    // 在设置页切换两次（来回切）
    await page.goto('/#/settings');
    await page.locator('.settings-language-field select').selectOption('en');
    await page.waitForTimeout(300);
    await page.locator('.settings-language-field select').selectOption('zh');
    await page.waitForTimeout(300);
    // 没有 React 循环错误
    expect(consoleErrors.some((e) => e.includes('Maximum update depth'))).toBe(false);
  });

  test('/models 路由会收口到 Settings，且语言保持英文', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await installApiMock(page);
    await page.goto('/#/settings');
    await page.locator('.settings-language-field select').selectOption('en');
    await page.goto('/#/models');
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    expect(errors.some((e) => e.includes('Maximum update depth'))).toBe(false);
  });
});
