import { expect, test } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

const markdownQuestion = {
  ...sampleQuestions[0],
  stem: '## Markdown 题干\n\n这是 **加粗内容**，包含 `inlineCode()`。\n\n- 第一项\n- 第二项',
  options: ['A. **普通选项**', 'B. `正确选项`'],
};

test.describe('侧边栏与 Markdown 题目', () => {
  test('侧边栏使用更大的图标和字号', async ({ page }) => {
    await installApiMock(page, { documents: sampleDocs, questions: sampleQuestions });
    await page.goto('/#/library');

    const metrics = await page.locator('.sidebar-link').first().evaluate((link) => {
      const icon = link.querySelector('svg') as SVGElement;
      return {
        fontSize: getComputedStyle(link).fontSize,
        iconWidth: icon.getBoundingClientRect().width,
        iconHeight: icon.getBoundingClientRect().height,
      };
    });

    expect(metrics.fontSize).toBe('14px');
    expect(metrics.iconWidth).toBe(18);
    expect(metrics.iconHeight).toBe(18);
  });

  test('做题和考试页面解析 Markdown 题干与选项', async ({ page }) => {
    await installApiMock(page, { documents: sampleDocs, questions: [markdownQuestion] });

    for (const path of ['/#/practice/2', '/#/exam/2']) {
      await page.goto(path);
      await expect(page.locator('.practice-question-stem h2')).toHaveText('Markdown 题干');
      await expect(page.locator('.practice-question-stem strong')).toHaveText('加粗内容');
      await expect(page.locator('.practice-question-stem code')).toHaveText('inlineCode()');
      await expect(page.locator('.practice-question-stem li')).toHaveCount(2);
      await expect(page.locator('.practice-option-text strong')).toHaveText('普通选项');
      await expect(page.locator('.practice-option-text code')).toHaveText('正确选项');
    }
  });

  test('做题记录页面解析 Markdown 题干与选项', async ({ page }) => {
    await installApiMock(page, {
      documents: sampleDocs,
      questions: [markdownQuestion],
      overrides: {
        listAttemptsByDocument: `() => Promise.resolve([
          { question_id: 101, user_answer: 'A', is_correct: false, attempted_at: 1000 }
        ])`,
      },
    });

    await page.goto('/#/records/2');
    await expect(page.locator('.practice-question-stem h2')).toHaveText('Markdown 题干');
    await expect(page.locator('.practice-question-stem strong')).toHaveText('加粗内容');
    await expect(page.locator('.practice-question-stem li')).toHaveCount(2);
    await expect(page.locator('.practice-option-text strong')).toHaveText('普通选项');
  });
});
