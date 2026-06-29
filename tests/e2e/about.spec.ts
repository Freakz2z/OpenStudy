import { test, expect } from '@playwright/test';
import { installApiMock } from './_helpers';

test.describe('「关于」页面', () => {
  test('Sidebar 显示「关于」入口', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/');
    await expect(page.getByRole('link', { name: '关于' })).toBeVisible();
  });

  test('点击「关于」跳转到 /about', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/');
    await page.getByRole('link', { name: '关于' }).click();
    await expect(page).toHaveURL(/#\/about$/);
    await expect(page.getByRole('heading', { name: '关于' })).toBeVisible();
  });

  test('显示 logo + 产品名 + 标语', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/about');
    // 顶部品牌卡显示 logo
    const brandCard = page.locator('.card').first();
    await expect(brandCard.locator('img[alt="OpenStudy"]')).toBeVisible();
    // h2 显示产品名
    await expect(brandCard.getByRole('heading', { name: 'OpenStudy' })).toBeVisible();
    // 标语
    await expect(brandCard).toContainText('Markdown-first 结构化题库与做题系统');
    await expect(brandCard.getByRole('link', { name: 'GitHub 仓库' })).toHaveAttribute(
      'href',
      'https://github.com/Freakz2z/OpenStudy',
    );
  });

  test('显示产品理念 / 核心功能 / 版本状态，并隐藏技术栈和许可证', async ({ page }) => {
    await installApiMock(page, {
      overrides: {
        checkLatestRelease: `() => Promise.resolve({
          currentVersion: '0.2.0',
          latestVersion: '0.3.0',
          upToDate: false,
          checkedAt: Date.now(),
          releaseUrl: 'https://github.com/Freakz2z/OpenStudy/releases/tag/v0.3.0',
          error: null
        })`,
      },
    });
    await page.goto('/#/about');
    await expect(page.getByRole('heading', { name: '产品理念' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '核心功能' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '版本状态' })).toBeVisible();
    await expect(page.getByText('发现新版本')).toBeVisible();
    await expect(page.getByRole('link', { name: '前往最新 Release' })).toHaveAttribute(
      'href',
      'https://github.com/Freakz2z/OpenStudy/releases/tag/v0.3.0',
    );
    await expect(page.getByRole('heading', { name: '技术栈' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '许可证' })).toHaveCount(0);
    await expect(page.getByText('Electron + React + TypeScript')).toHaveCount(0);
  });

  test('英文模式下显示 About / Philosophy / Features / Version status', async ({ page }) => {
    await installApiMock(page, {
      documents: [],
      questions: [],
    });
    await page.goto('/#/settings');
    await page.locator('.settings-language-field select').selectOption('en');
    await page.waitForTimeout(500);
    await page.goto('/#/about');
    await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Philosophy' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Core Features' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Version status' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tech Stack' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'License' })).toHaveCount(0);
  });
});

test.describe('Sidebar 品牌区精简', () => {
  test('浅色模式下侧边栏不再显示顶部 Logo', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/');
    await expect(page.locator('.sidebar-brand')).toHaveCount(0);
  });

  test('深色模式下侧边栏也不显示顶部 Logo', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'openstudy-prefs',
        JSON.stringify({ theme: 'dark', lang: 'zh' }),
      );
    });
    await installApiMock(page);
    await page.goto('/');
    await page.goto('/#/settings');
    await page.getByRole('button', { name: '深色' }).click();
    await expect(page.locator('.sidebar-brand')).toHaveCount(0);
  });
});

test.describe('统一布局', () => {
  for (const route of ['/library', '/wrong', '/settings', '/about']) {
    test(`${route} 使用带分隔线的统一页头`, async ({ page }) => {
      await installApiMock(page);
      await page.goto(`/#${route}`);
      const border = await page.locator('.page-header').evaluate(
        (element) => getComputedStyle(element).borderBottomStyle,
      );
      expect(border).toBe('solid');
    });
  }

  for (const route of ['/settings']) {
    test(`${route} 内容宽度随窗口伸缩`, async ({ page }) => {
      await installApiMock(page);
      await page.setViewportSize({ width: 950, height: 760 });
      await page.goto(`/#${route}`);
      const narrow = await page.locator('.page').evaluate(
        (element) => element.getBoundingClientRect().width,
      );
      await page.setViewportSize({ width: 1280, height: 760 });
      const wide = await page.locator('.page').evaluate(
        (element) => element.getBoundingClientRect().width,
      );
      expect(wide).toBeGreaterThan(narrow + 200);
    });
  }
});
