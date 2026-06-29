import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

test.describe('答题快捷键', () => {
  test('选择题按字母键直接选择', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('B');
    await expect(page.locator('input[type="radio"][value="B. 北京"]')).toBeChecked();
  });

  test('ArrowDown 可以选择下一个选项', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('input[type="radio"][value="A. 上海"]')).toBeChecked();
  });

  test('ArrowUp 可以选择上一个选项', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('input[type="radio"][value="D. 深圳"]')).toBeChecked();
  });

  test('回车触发判分', async ({ page }) => {
    await installApiMock(page, {
      questions: sampleQuestions.slice(0, 2),
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    // 用字母键选中（避开 radio 默认 Enter 行为）
    await page.keyboard.press('B');
    await expect(page.locator('input[type="radio"][value="B. 北京"]')).toBeChecked();
    await page.waitForTimeout(200);
    // blur radio，让 Enter 不触发其默认行为
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    await expect(page.getByText('✓ 正确')).toBeVisible();
  });

  test('用字母快捷键选项后立刻回车也能判分', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('B');
    await page.keyboard.press('Enter');
    await expect(page.getByText('✓ 正确')).toBeVisible();
  });

  test('Space 可以直接展开参考答案', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await expect(page.getByText('已展开参考答案')).toBeVisible();
    await expect(page.getByText('参考答案：')).toBeVisible();
    await expect(
      page.locator('.practice-result-card .answer-panel').filter({ hasText: /^B\. 北京$/ }).first(),
    ).toBeVisible();
  });

  test('判分后再按回车进入下一题', async ({ page }) => {
    await installApiMock(page, {
      questions: sampleQuestions.slice(0, 2),
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('A');
    await expect(page.locator('input[type="radio"][value="A. 上海"]')).toBeChecked();
    await page.waitForTimeout(200);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    await expect(page.getByText('✗ 错误')).toBeVisible();
    // 判分后等 React rerender 完成
    await page.waitForTimeout(300);
    // blur 当前 focus（避免 autoFocus 残留导致双触发）
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    await expect(page.getByText('《静夜思》的作者是___。')).toBeVisible();
  });

  test('ArrowLeft 可以回到上一题', async ({ page }) => {
    await installApiMock(page, {
      questions: sampleQuestions.slice(0, 2),
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('B');
    await page.keyboard.press('Enter');
    await expect(page.getByText('✓ 正确')).toBeVisible();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    await expect(page.getByText('《静夜思》的作者是___。')).toBeVisible();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('中国的首都是？')).toBeVisible();
  });

  test('填空题输入后回车判分', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[1]],
    });
    await page.goto('/#/practice/2');
    const input = page.getByPlaceholder('输入答案');
    await input.click();
    await input.fill('李白');
    await input.press('Enter');
    await expect(page.getByText('✓ 正确')).toBeVisible();
  });

  test('简答题 Enter 直接提交', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[2]],
    });
    await page.goto('/#/practice/2');
    const textarea = page.getByPlaceholder(/输入答案/);
    await textarea.click();
    await textarea.fill('促进生产力');
    await textarea.press('Enter');
    await expect(page.getByText('✓ 正确')).toBeVisible();
  });
});

test.describe('答题反馈强化', () => {
  test('选择题答案位置高亮（绿色背景）', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
    });
    await page.goto('/#/practice/2');
    await page.locator('label').filter({ hasText: 'B. 北京' }).click();
    await page.getByRole('button', { name: '提交' }).click();
    // 正确答案选项有绿色背景
    const rightLabel = page.locator('label').filter({ hasText: 'B. 北京' });
    await expect(rightLabel).toHaveClass(/correct/);
  });

  test('选择题用户错选位置高亮（红色背景）', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
    });
    await page.goto('/#/practice/2');
    await page.locator('label').filter({ hasText: 'A. 上海' }).click();
    await page.getByRole('button', { name: '提交' }).click();
    const wrongLabel = page.locator('label').filter({ hasText: 'A. 上海' });
    await expect(wrongLabel).toHaveClass(/wrong/);
  });

  test('填空题判分后输入框背景色变化', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[1]],
    });
    await page.goto('/#/practice/2');
    const input = page.getByPlaceholder('输入答案');
    await input.fill('李白');
    await page.getByRole('button', { name: '提交' }).click();
    await expect(input).toHaveClass(/correct/);
  });

  test('判分后显示「你的答案」', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[1]],
    });
    await page.goto('/#/practice/2');
    await page.getByPlaceholder('输入答案').fill('错误的答案');
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText(/你的答案.*错误的答案/)).toBeVisible();
  });
});

test.describe('Practice 完成页', () => {
  test('Practice 完成页错题列表展示本轮答错的题', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions.slice(0, 2),
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    // 第 1 题：答对
    await page.keyboard.press('B');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter'); // 判分
    await expect(page.getByText('✓ 正确')).toBeVisible();
    await page.keyboard.press('Enter'); // 下一题
    // 第 2 题：填空题，需先 focus
    const input = page.getByPlaceholder('输入答案');
    await input.click();
    await input.fill('杜甫');
    await input.press('Enter'); // 判分
    await expect(page.getByText('✗ 错误')).toBeVisible();
    await page.keyboard.press('Enter'); // 下一题
    // 完成页
    await expect(page.getByText('完成！')).toBeVisible();
    await expect(page.getByText('本轮错题（1）')).toBeVisible();
    await expect(page.getByText('《静夜思》的作者是___。')).toBeVisible();
    await expect(page.getByText(/你的答案.*杜甫/)).toBeVisible();
    await expect(page.getByText(/正确答案.*李白/)).toBeVisible();
  });

  test('Practice 全对时不在完成页显示错题列表', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions.slice(0, 2),
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('B');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await expect(page.getByText('✓ 正确')).toBeVisible();
    await page.keyboard.press('Enter');
    const input = page.getByPlaceholder('输入答案');
    await input.click();
    await input.fill('李白');
    await input.press('Enter');
    await expect(page.getByText('✓ 正确')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByText('完成！')).toBeVisible();
    await expect(page.getByText('本轮错题')).not.toBeVisible();
  });
});

test.describe('page_or_section 清洗', () => {
  test('去除「第 X/Y 段」调试标记', async ({ page }) => {
    await installApiMock(page, {
      questions: [
        {
          ...sampleQuestions[0],
          page_or_section: '第 2/5 段 38题',
        },
      ],
    });
    await page.goto('/#/practice/2');
    // 不应出现「第 2/5 段」字样，但保留「38题」
    await expect(page.locator('text=/第 \\d+\\/\\d+ 段/')).toHaveCount(0);
  });
});
