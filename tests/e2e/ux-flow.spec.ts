import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs } from './_helpers';

test.describe('全局使用流程', () => {
  test('启动时直接应用已保存的主题与语言', async ({ page }) => {
    await installApiMock(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'openstudy-prefs',
        JSON.stringify({ theme: 'dark', lang: 'en' }),
      );
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
    await expect(page.locator('.sidebar-brand')).toHaveCount(0);
  });

  test('无效地址自动回到概览', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/not-a-real-page');
    await expect(page).toHaveURL(/#\/overview$/);
    await expect(page.getByRole('heading', { name: '数据概览' })).toBeVisible();
  });

  test('题库加载完成前不闪烁空状态', async ({ page }) => {
    let resolveDocuments: (value: unknown) => void = () => {};
    await page.exposeFunction(
      '__holdDocuments',
      () => new Promise((resolve) => { resolveDocuments = resolve; }),
    );
    await installApiMock(page, {
      overrides: {
        listDocuments: 'async function() { return await window.__holdDocuments(); }',
      },
    });
    await page.goto('/#/library');
    await expect(page.getByText('正在加载题库…')).toBeVisible();
    await expect(page.getByText('还没有文档。')).not.toBeVisible();
    resolveDocuments([]);
    await expect(page.getByText('还没有文档。')).toBeVisible();
  });

  test('切换页面后主内容滚动位置归零', async ({ page }) => {
    const documents = Array.from({ length: 12 }, (_, index) => ({
      ...sampleDocs[1],
      id: index + 1,
      title: `文档 ${index + 1}`,
    }));
    await installApiMock(page, { documents });
    await page.goto('/');
    await page.locator('#app-main').evaluate((element) => {
      element.scrollTop = 600;
    });
    await page.getByRole('link', { name: '错题本' }).click();
    await expect.poll(
      () => page.locator('#app-main').evaluate((element) => element.scrollTop),
    ).toBe(0);
  });
});
