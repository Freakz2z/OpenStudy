import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs } from './_helpers';

test.describe('Markdown 编辑原文件', () => {
  test('Library 显示「编辑文件」按钮', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
    });
    await page.goto('/#/library');
    const card = page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    await expect(
      card.getByRole('button', { name: '编辑文件' }),
    ).toBeVisible();
  });

  test('点「编辑文件」进入 MarkdownEditor 页面', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
    });
    await page.goto('/#/library');
    const card = page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    await card.getByRole('button', { name: '编辑文件' }).click();
    await expect(page).toHaveURL(/#\/markdown\/2/);
    await expect(page.getByRole('heading', { name: /编辑原文件/ })).toBeVisible();
  });

  test('MarkdownEditor 加载并显示源文件 Markdown', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      overrides: {
        getMarkdown: `async function() {
          return { markdown: '# 标题\\n\\n第一段\\n\\n第二段', source: 'fresh' };
        }`,
      },
    });
    await page.goto('/#/markdown/2');
    await expect(page.locator('textarea')).toHaveValue(
      /# 标题/,
    );
    // 显示来自原始文件 badge
    await expect(page.locator('.badge').getByText('原始文件')).toBeVisible();
  });

  test('编辑后点保存调用 saveMarkdown', async ({ page }) => {
    let savedWith: { docId: number; markdown: string } | null = null;
    await page.exposeFunction('__onSave', (docId: number, md: string) => {
      savedWith = { docId, markdown: md };
    });
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      overrides: {
        getMarkdown: `async function() {
          return { markdown: '原文', source: 'fresh' };
        }`,
        saveMarkdown: `async function(docId, md) {
          await window.__onSave(docId, md);
          return { ok: true };
        }`,
      },
    });
    await page.goto('/#/markdown/2');
    const textarea = page.locator('textarea');
    await textarea.fill('修改后的内容');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('已保存')).toBeVisible();
    expect(savedWith).toMatchObject({ docId: 2, markdown: '修改后的内容' });
  });

  test('未修改时保存按钮禁用', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      overrides: {
        getMarkdown: `async function() {
          return { markdown: '原文', source: 'fresh' };
        }`,
      },
    });
    await page.goto('/#/markdown/2');
    // 默认未修改时保存按钮 disabled
    await expect(page.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  test('修改后未保存显示「未保存」标记', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      overrides: {
        getMarkdown: `async function() {
          return { markdown: '原文', source: 'fresh' };
        }`,
      },
    });
    await page.goto('/#/markdown/2');
    await page.locator('textarea').fill('改了');
    await expect(page.getByText('未保存')).toBeVisible();
  });

  test('「预览」标签页只读显示', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      overrides: {
        getMarkdown: `async function() {
          return { markdown: '原文内容', source: 'fresh' };
        }`,
      },
    });
    await page.goto('/#/markdown/2');
    await page.getByRole('button', { name: '预览' }).click();
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.getByText('原文内容')).toBeVisible();
  });

  test('已编辑过的文档显示「已编辑」badge', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      overrides: {
        getMarkdown: `async function() {
          return { markdown: '已编辑', source: 'db' };
        }`,
      },
    });
    await page.goto('/#/markdown/2');
    await expect(page.locator('.badge').getByText('已编辑')).toBeVisible();
  });

  test('显示题目预检摘要与问题提示', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      overrides: {
        getMarkdown: `async function() {
          return {
            markdown: '## 1. 第一题\\nA. 甲\\nB. 乙\\n答案：A\\n\\n## 2. 第二题\\nA. 只有一个选项',
            source: 'fresh'
          };
        }`,
      },
    });
    await page.goto('/#/markdown/2');
    await expect(page.getByText('题目预检')).toBeVisible();
    await expect(page.getByText('预估题目 2')).toBeVisible();
    await expect(page.getByText(/疑似只有 1 个选项/)).toBeVisible();
  });
});
