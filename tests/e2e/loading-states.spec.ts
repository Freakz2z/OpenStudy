import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

test.describe('Library 操作 loading 状态', () => {
  test('点删除触发确认对话框，删除期间按钮显示「删除中…」', async ({ page }) => {
    let resolveDelete: (v: unknown) => void = () => {};
    await page.exposeFunction('__holdDelete', () => new Promise<void>((r) => { resolveDelete = () => r(); }));
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions,
      overrides: {
        deleteDocument: `async function(id) {
          await window.__holdDelete();
          return { ok: true };
        }`,
      },
    });
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.goto('/#/library');
    const card = page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    const delBtn = card.getByRole('button', { name: '删除' });
    await delBtn.click();
    // 删除期间按钮变文字并被禁用
    const deletingBtn = card.getByRole('button', { name: '删除中…' });
    await expect(deletingBtn).toBeVisible();
    await expect(deletingBtn).toBeDisabled();
    resolveDelete(undefined);
    await expect(card.getByRole('button', { name: '删除' })).toBeVisible();
  });

  test('导入期间按钮显示「导入中…」', async ({ page }) => {
    let resolveImport: (v: unknown) => void = () => {};
    await page.exposeFunction('__holdImport', () => new Promise<void>((r) => { resolveImport = () => r(); }));
    await installApiMock(page, {
      overrides: {
        importFile: `async function() {
          await window.__holdImport();
          return null;
        }`,
      },
    });
    await page.goto('/#/library');
    await page.getByRole('button', { name: '导入文档' }).click();
    const loadingBtn = page.getByRole('button', { name: '导入中…' });
    await expect(loadingBtn).toBeVisible();
    await expect(loadingBtn).toBeDisabled();
    resolveImport(undefined);
    await expect(page.getByRole('button', { name: '导入文档' })).toBeVisible();
  });
});

test.describe('Library 警告 vs 错误', () => {
  test('识别空结果用警告样式（黄色）而非红色', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: [],
    });
    await page.goto('/#/library');
    await page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]')
      .getByRole('button', { name: '识别题目' })
      .click();
    // 警告文本
    await expect(page.getByText(/识别完成但未找到题目/)).toBeVisible();
    // 警告卡片应有黄色背景（不是 .error class）
    const warningCard = page.locator('text=/识别完成但未找到题目/').locator('xpath=ancestor::div[contains(@class,"card")]').first();
    await expect(warningCard).toHaveClass(/warning/);
  });

  test('识别失败用错误样式（红色）', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: [],
      overrides: {
        identifyQuestions: `async function() { throw new Error('LLM 输出无法解析为合法 JSON'); }`,
      },
    });
    await page.goto('/#/library');
    await page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]')
      .getByRole('button', { name: '识别题目' })
      .click();
    await expect(page.getByText(/LLM 输出无法解析/)).toBeVisible();
    // 错误卡片应有 .error class
    const errorCard = page.locator('.card.error').first();
    await expect(errorCard).toBeVisible();
  });

  test('错误卡片保留到用户主动关闭', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: [],
      overrides: {
        identifyQuestions: `async function() { throw new Error('临时错误'); }`,
      },
    });
    await page.goto('/#/library');
    await page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]')
      .getByRole('button', { name: '识别题目' })
      .click();
    await expect(page.getByText('临时错误')).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.getByText('临时错误')).toBeVisible();
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.getByText('临时错误')).not.toBeVisible();
  });

  test('错误卡片右侧有 ✕ 关闭按钮', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: [],
      overrides: {
        identifyQuestions: `async function() { throw new Error('test error'); }`,
      },
    });
    await page.goto('/#/library');
    await page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]')
      .getByRole('button', { name: '识别题目' })
      .click();
    await expect(page.getByText('test error')).toBeVisible();
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.getByText('test error')).not.toBeVisible();
  });
});
