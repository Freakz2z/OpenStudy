import { test, expect } from '@playwright/test';
import { installApiMock, sampleQuestions, type WrongQuestion } from './_helpers';

test.describe('错题本完整闭环', () => {
  test('做错题 → 出现在错题本 → 重做答对 → 从错题本消失', async ({ page }) => {
    // Node 端持久化错题本与题目
    const wrongBank: WrongQuestion[] = [];
    const questions: typeof sampleQuestions = sampleQuestions;

    await page.exposeFunction('__getQuestions', () => questions);
    await page.exposeFunction('__getWrong', () => wrongBank);
    await page.exposeFunction('__addWrong', (q: WrongQuestion) => {
      wrongBank.push(q);
    });
    await page.exposeFunction('__removeWrong', (qId: number) => {
      const i = wrongBank.findIndex((q) => q.id === qId);
      if (i >= 0) wrongBank.splice(i, 1);
    });

    // 用 exposeFunction 调：window.api.getQuestionsByDocument 由 Practice 调用，
    // 直接用 installApiMock 默认的 sampleQuestions 即可；
    // saveAttempt / listWrongQuestions 走 Node 端
    await installApiMock(page, {
      questions: sampleQuestions,
      documents: [],
      overrides: {
        saveAttempt: `async function(qId, userAnswer, isCorrect) {
          console.log('[mock saveAttempt called]', qId, isCorrect);
          if (!isCorrect) {
            const qs = await window.__getQuestions();
            console.log('[mock saveAttempt] qs.length=', (qs||[]).length);
            const q = qs.find(function(x){ return x.id === qId; });
            console.log('[mock saveAttempt] q found=', !!q);
            if (q) {
              await window.__addWrong(Object.assign({}, q, {
                last_wrong_answer: userAnswer,
                last_wrong_at: Date.now(),
                document_title: '历史简答',
                document_file_type: 'docx'
              }));
              console.log('[mock saveAttempt] added to wrongBank');
            }
          } else {
            await window.__removeWrong(qId);
          }
          return { ok: true };
        }`,
        listWrongQuestions: `async function() { return await window.__getWrong(); }`,
      },
    });

    // ===== 第一轮：故意做错 =====
    await page.goto('/#/practice/2');
    await expect(page.getByText('中国的首都是？')).toBeVisible();
    await page.locator('label').filter({ hasText: 'A. 上海' }).click();
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✗ 错误')).toBeVisible();

    // 验证：错题本里有了
    await page.goto('/#/wrong');
    await expect(page.getByRole('heading', { name: '错题本' })).toBeVisible();
    await page.getByRole('button', { name: /历史简答/ }).click();
    const wrongContent = await page.locator('main').textContent();
    console.log('[debug] wrong page content:', wrongContent);
    console.log('[debug] wrongBank:', JSON.stringify(wrongBank));
    await expect(page.getByText('你的答案')).toBeVisible();
    await expect(page.getByText('A. 上海')).toBeVisible();
    await expect(page.getByText('正确答案')).toBeVisible();
    await expect(page.getByText('B. 北京')).toBeVisible();
    expect(wrongBank).toHaveLength(1);

    // ===== 第二轮：重做答对 =====
    await page.getByRole('button', { name: '重做' }).click();
    await expect(page).toHaveURL(/#\/practice\/2\?from=wrong/);
    await page.locator('label').filter({ hasText: 'B. 北京' }).click();
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✓ 正确')).toBeVisible();

    // 验证：错题本清空
    await page.goto('/#/wrong');
    await expect(page.getByText('还没有错题。做错题后会出现在这里。')).toBeVisible();
    expect(wrongBank).toHaveLength(0);
  });
});
