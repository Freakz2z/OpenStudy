import { test, expect } from '@playwright/test';
import { installApiMock } from './_helpers';

test.describe('路由边界', () => {
  test('访问不存在的文档做题页显示空状态', async ({ page }) => {
    await installApiMock(page, { questions: [] });
    await page.goto('/#/practice/9999');
    await expect(page.getByText('没有题目')).toBeVisible();
  });

  test('访问设置页直接渲染（不需要 docId）', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  });

  test('访问根路径默认显示概览页', async ({ page }) => {
    await installApiMock(page, { documents: [] });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '数据概览' })).toBeVisible();
  });

  test('侧边栏高亮当前路由', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/settings');
    const settingsLink = page.getByRole('link', { name: '设置' });
    await expect(settingsLink).toHaveClass(/active/);

    await page.goto('/#/wrong');
    const wrongLink = page.getByRole('link', { name: '错题本' });
    await expect(wrongLink).toHaveClass(/active/);
  });
});

test.describe('视觉回归 - 关键元素存在', () => {
  test('Library 页面骨架完整', async ({ page }) => {
    await installApiMock(page, { documents: [] });
    await page.goto('/#/library');
    await expect(page.locator('.sidebar-brand')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '题库' })).toBeVisible();
    await expect(
      page.locator('.page-header').getByRole('button', { name: '导入文档' }),
    ).toBeVisible();
  });

  test('Overview 页面骨架完整', async ({ page }) => {
    await installApiMock(page, { documents: [] });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '数据概览' })).toBeVisible();
    await expect(page.locator('.overview-metrics-grid')).toBeVisible();
  });

  test('Practice 页面骨架完整', async ({ page }) => {
    await installApiMock(page, {
      questions: [
        {
          id: 1,
          document_id: 1,
          type: 'choice',
          stem: '测试题',
          options: ['A. 甲', 'B. 乙'],
          answer: 'A',
          explanation: null,
          page_or_section: null,
          position: 0,
        },
      ],
      documents: [],
    });
    await page.goto('/#/practice/1');
    await expect(page.getByText('选择题')).toBeVisible();
    await expect(page.locator('.question-nav')).toBeVisible();
    await expect(page.getByRole('button', { name: '← 返回' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '' })).toBeVisible();
  });

  test('Settings 页面骨架完整', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '外观' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '语言' })).toBeVisible();
  });

  test('Models 页面骨架完整', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/models');
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'LLM 模型', exact: true })).toBeVisible();
    await expect(page.locator('label').filter({ hasText: '服务方' })).toBeVisible();
    await expect(page.locator('label').filter({ hasText: 'Base URL' })).toBeVisible();
    await expect(page.locator('label').filter({ hasText: '模型名称' })).toBeVisible();
    await expect(page.getByRole('button', { name: '测试模型' })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存' })).toBeVisible();
  });
});
