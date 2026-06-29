import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs } from './_helpers';

test.describe('Library 错误处理与边界', () => {
  test('识别失败显示错误信息', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[0]],
      questions: [],
      overrides: {
        identifyQuestions: `async (docId) => { throw new Error('LLM 输出无法解析为合法 JSON\\n原始返回：not json'); }`,
      },
    });
    await page.goto('/#/library');
    await expect(page.getByText('代数练习题')).toBeVisible();
    await page.getByRole('button', { name: '识别题目' }).click();
    await expect(page.getByText(/LLM 输出无法解析/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '识别题目' })).toBeEnabled();
  });

  test('导入失败显示错误信息', async ({ page }) => {
    await installApiMock(page, {
      documents: [],
      overrides: {
        importFile: `async () => { throw new Error('文件已被占用'); }`,
      },
    });
    await page.goto('/#/library');
    await page.locator('.page-header').getByRole('button', { name: '导入文档' }).click();
    await expect(page.getByText('文件已被占用')).toBeVisible();
  });

  test('点击删除触发确认对话框', async ({ page }) => {
    let confirmCalled = false;
    page.on('dialog', async (dialog) => {
      confirmCalled = true;
      expect(dialog.message()).toContain('确定删除');
      await dialog.accept();
    });
    let deleteCalledWith: number | null = null;
    await page.exposeFunction('__onDelete', (id: number) => {
      deleteCalledWith = id;
    });
    await installApiMock(page, {
      documents: [sampleDocs[0]],
      overrides: {
        deleteDocument: `async (id) => { await window.__onDelete(id); return { ok: true }; }`,
      },
    });
    await page.goto('/#/library');
    await expect(page.getByText('代数练习题')).toBeVisible();
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => confirmCalled).toBe(true);
    await expect.poll(() => deleteCalledWith).toBe(1);
  });

  test('题目数为 0 时禁用「做题」按钮', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[0]],
      questions: [],
    });
    await page.goto('/#/library');
    const practiceBtn = page
      .getByText('代数练习题')
      .locator('xpath=ancestor::div[contains(@class,"card")]')
      .getByRole('button', { name: '做题' });
    await expect(practiceBtn).toBeDisabled();
  });
});

test.describe('模型设置往返', () => {
  test('修改 base url + 模型 + api key 后保存', async ({ page }) => {
    let persistedSettings: unknown = null;
    await page.exposeFunction('__persist', (s: unknown) => {
      persistedSettings = s;
    });
    await installApiMock(page, {
      overrides: {
        updateSettings: `async (s) => { await window.__persist(s); return s; }`,
      },
    });
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();

    await page.locator('.settings-model-card select').first().selectOption('anthropic');
    await page.locator('input[placeholder]').first().fill('https://custom.anthropic.example');
    await page.locator('input[placeholder]').nth(1).fill('claude-sonnet-4-6');
    await page.locator('input[type="password"]').fill('sk-ant-custom-test');

    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('已保存')).toBeVisible();

    expect(persistedSettings).toMatchObject({
      llm: {
        provider: 'anthropic',
        baseUrl: 'https://custom.anthropic.example',
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-ant-custom-test',
      },
    });
  });

  test('修改后未保存则不显示「已保存」', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/settings');
    await page.locator('input[type="password"]').fill('some-key');
    await expect(page.getByText('已保存')).not.toBeVisible();
  });
});
