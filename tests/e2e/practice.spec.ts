import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

test.describe('Practice 页面', () => {
  test('完整做完一道选择题（正确路径）', async ({ page }) => {
    await installApiMock(page, {
      questions: sampleQuestions,
      documents: [],
    });
    await page.goto('/#/practice/2');

    // 第 1 题是选择
    await expect(page.getByText('中国的首都是？')).toBeVisible();
    // 点击包含选项文本的 label（更可靠）
    await page.locator('label').filter({ hasText: 'B. 北京' }).click();
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✓ 正确')).toBeVisible();
    await expect(page.getByText('参考答案：')).toBeVisible();
    await expect(
      page.locator('.practice-result-card .answer-panel').filter({ hasText: /^B\. 北京$/ }).first(),
    ).toBeVisible();
    // 下一题
    await page.getByRole('button', { name: '下一题' }).click();

    // 第 2 题是填空
    await expect(page.getByText('《静夜思》的作者是___。')).toBeVisible();
    await page.locator(".practice-ai-toggle").click(); await page.waitForTimeout(200); await page.getByPlaceholder('输入答案').fill('李白');
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✓ 正确')).toBeVisible();
    await page.getByRole('button', { name: '下一题' }).click();

    // 第 3 题是简答
    await expect(page.getByText('简述工业革命的影响。')).toBeVisible();
    await page.locator(".practice-ai-toggle").click(); await page.waitForTimeout(200); await page.getByPlaceholder('输入答案').fill('促进了生产力和城市化');
    await page.getByRole('button', { name: '提交' }).click();
    // 简答采用宽松匹配，包含所有关键词即正确
    await expect(page.getByText('✓ 正确')).toBeVisible();
    await page.getByRole('button', { name: '下一题' }).click();

    // 全部完成
    await expect(page.getByText('完成！')).toBeVisible();
    await expect(page.getByText('正确 3')).toBeVisible();
    await expect(page.getByText('错误 0')).toBeVisible();
  });

  test('选择题选错后显示错误状态', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
      documents: [],
    });
    await page.goto('/#/practice/2');
    await expect(page.getByText('中国的首都是？')).toBeVisible();
    await page.locator('label').filter({ hasText: 'A. 上海' }).click();
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✗ 错误')).toBeVisible();
    await expect(
      page.locator('.practice-result-card .answer-panel').filter({ hasText: /^A\. 上海$/ }),
    ).toBeVisible();
    await expect(
      page.locator('.practice-result-card .answer-panel').filter({ hasText: /^B\. 北京$/ }),
    ).toBeVisible();
  });

  test('选项 hover 时不发生位移', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
      documents: [],
    });
    await page.goto('/#/practice/2');
    await page.waitForTimeout(400);

    const option = page.locator('label').filter({ hasText: 'B. 北京' });
    const before = await option.boundingBox();
    expect(before).not.toBeNull();

    await option.hover();
    const after = await option.boundingBox();
    expect(after).not.toBeNull();

    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(0.5);
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(0.5);
  });

  test('无题目时显示空状态', async ({ page }) => {
    await installApiMock(page, { questions: [], documents: [] });
    await page.goto('/#/practice/2');
    await expect(page.getByText('没有题目')).toBeVisible();
  });

  test('每题 AI 提问可以返回结果', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
      documents: [],
      overrides: {
        askPracticeQuestion: `() => Promise.resolve('这道题考察首都常识与基础地理知识。')`,
      },
    });
    await page.goto('/#/practice/2');
    await page.locator(".practice-ai-toggle").click(); await page.waitForTimeout(200); await page.getByPlaceholder('例如：这道题考察什么知识点？').fill('这道题考什么？');
    await page.getByRole('button', { name: '提问' }).click();
    await expect(page.getByText('这道题考察首都常识与基础地理知识。')).toBeVisible();
  });

  test('AI 面板替换右侧目录，且做题页仅内部区域滚动', async ({ page }) => {
    const manyQuestions = Array.from({ length: 90 }, (_, index) => ({
      id: index + 1,
      document_id: 2,
      type: 'choice' as const,
      stem: `第 ${index + 1} 题`,
      options: ['A. 甲', 'B. 乙', 'C. 丙', 'D. 丁'],
      answer: 'A',
      explanation: null,
      page_or_section: null,
      position: index,
    }));

    await installApiMock(page, {
      questions: manyQuestions,
      documents: [],
    });
    await page.goto('/#/practice/2');

    await page.locator('.page-header-actions .practice-ai-toggle').click();
    await expect(page.locator('.practice-ai-drawer')).toBeVisible();
    await expect(page.locator('.question-nav')).toHaveCount(0);

    const metrics = await page.evaluate(() => {
      const practicePage = document.querySelector('.practice-page') as HTMLElement | null;
      const main = document.querySelector('.practice-main') as HTMLElement | null;
      const drawer = document.querySelector('.practice-ai-drawer') as HTMLElement | null;
      const thread = document.querySelector('.practice-ai-thread') as HTMLElement | null;
      const askButton = document.querySelector('.practice-ai-composer button') as HTMLElement | null;
      if (!practicePage || !main || !drawer || !thread || !askButton) return null;

      const pageRect = practicePage.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const drawerRect = drawer.getBoundingClientRect();
      const askButtonRect = askButton.getBoundingClientRect();
      const pageStyle = getComputedStyle(practicePage);
      const mainStyle = getComputedStyle(main);
      const threadStyle = getComputedStyle(thread);

      return {
        pageHeight: pageRect.height,
        pageOverflowY: pageStyle.overflowY,
        mainHeight: mainRect.height,
        drawerHeight: drawerRect.height,
        drawerLeft: drawerRect.left,
        drawerRight: drawerRect.right,
        mainRight: mainRect.right,
        mainWidth: mainRect.width,
        drawerWidth: drawerRect.width,
        stageRight: drawer.parentElement?.getBoundingClientRect().right ?? 0,
        askButtonRight: askButtonRect.right,
        topDiff: Math.abs(drawerRect.top - mainRect.top),
        mainOverflowY: mainStyle.overflowY,
        threadOverflowY: threadStyle.overflowY,
        mainCanScroll: main.scrollHeight > main.clientHeight,
        threadCanScroll: thread.scrollHeight > thread.clientHeight,
      };
    });

    expect(metrics).not.toBeNull();
    expect(['hidden', 'clip']).toContain(metrics?.pageOverflowY ?? '');
    expect(Math.abs((metrics?.mainHeight ?? 0) - (metrics?.drawerHeight ?? 0))).toBeLessThan(1);
    expect(metrics?.drawerLeft).toBeGreaterThan(metrics?.mainRight ?? 0);
    expect(Math.abs((metrics?.mainWidth ?? 0) - (metrics?.drawerWidth ?? 0))).toBeLessThan(1);
    expect(metrics?.drawerRight).toBeLessThanOrEqual((metrics?.stageRight ?? 0) + 1);
    expect(metrics?.askButtonRight).toBeLessThanOrEqual((metrics?.drawerRight ?? 0) - 1);
    expect(metrics?.topDiff).toBeLessThan(1);
    expect(['auto', 'scroll']).toContain(metrics?.mainOverflowY ?? '');
    expect(['auto', 'scroll']).toContain(metrics?.threadOverflowY ?? '');
  });

  test('AI 对话支持 Markdown、刷新后仍保留，并出现在对话记录页', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
      documents: [sampleDocs[1]],
      overrides: {
        askPracticeQuestion: `() => Promise.resolve('**重点**\\n\\n- 第一条\\n- 第二条')`,
      },
    });

    await page.goto('/#/practice/2');
    await page.locator('.practice-ai-toggle').click();
    await page.getByPlaceholder('例如：这道题考察什么知识点？').fill('帮我总结');
    await page.getByRole('button', { name: '提问' }).click();

    await expect(page.locator('.practice-ai-bubble strong')).toHaveText('重点');
    await expect(page.getByText('第一条')).toBeVisible();

    await page.reload();
    await page.locator('.practice-ai-toggle').click();
    await expect(page.locator('.practice-ai-bubble strong')).toHaveText('重点');

    await page.goto('/#/conversations');
    await expect(page.getByRole('heading', { name: '对话记录' })).toBeVisible();
    await expect(page.getByText('历史简答')).toBeVisible();
    await expect(page.getByText('中国的首都是？')).toBeVisible();
    await expect(page.locator('.conversation-message-bubble strong')).toHaveText('重点');
  });

  test('左侧主区域底部常驻上一题、提交、答案、下一题，并显示分割线', async ({ page }) => {
    await installApiMock(page, {
      questions: [sampleQuestions[0]],
      documents: [],
    });

    await page.goto('/#/practice/2');

    const metrics = await page.evaluate(() => {
      const main = document.querySelector('.practice-main') as HTMLElement | null;
      const row = document.querySelector('.practice-submit-row') as HTMLElement | null;
      if (!main || !row) return null;
      const mainRect = main.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const styles = getComputedStyle(row);
      return {
        gapToBottom: Math.round(mainRect.bottom - rowRect.bottom),
        borderTopWidth: styles.borderTopWidth,
        borderTopStyle: styles.borderTopStyle,
      };
    });

    expect(metrics).not.toBeNull();
    expect((metrics?.gapToBottom ?? 99)).toBeLessThanOrEqual(8);
    expect(metrics?.borderTopWidth).not.toBe('0px');
    expect(metrics?.borderTopStyle).toBe('solid');

    await expect(page.getByRole('button', { name: '上一题' })).toBeVisible();
    await expect(page.getByRole('button', { name: '上一题' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '提交' })).toBeVisible();
    await expect(page.getByRole('button', { name: '答案' })).toBeVisible();
    await expect(page.getByRole('button', { name: '下一题' })).toBeVisible();
  });
});
