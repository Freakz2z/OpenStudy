import { test } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';
import * as fs from 'node:fs';

const SHOTS = 'test-results/visual';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

test('practice 视觉验证', async ({ page }) => {
  await installApiMock(page, {
    documents: sampleDocs,
    questions: sampleQuestions,
  });
  await page.goto('/#/practice/2');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/practice-round3.png`, fullPage: true });

  const m = await page.evaluate(() => {
    const main = document.querySelector('.practice-page');
    const stage = document.querySelector('.practice-stage');
    const mainCol = document.querySelector('.practice-main');
    const nav = document.querySelector('.question-nav');
    return {
      page: main?.getBoundingClientRect(),
      stage: stage?.getBoundingClientRect(),
      mainCol: mainCol?.getBoundingClientRect(),
      nav: nav?.getBoundingClientRect(),
    };
  });
  console.log('PRACTICE:', JSON.stringify(m, null, 2));
});

test('wrongbook 视觉验证', async ({ page }) => {
  await installApiMock(page, {
    wrong: [
      {
        ...sampleQuestions[0],
        document_id: 1,
        last_wrong_answer: 'A',
        last_wrong_at: Date.now(),
        document_title: '代数练习题',
        document_file_type: 'pdf',
      },
      {
        ...sampleQuestions[1],
        document_id: 1,
        last_wrong_answer: 'B',
        last_wrong_at: Date.now(),
        document_title: '代数练习题',
        document_file_type: 'pdf',
      },
      {
        ...sampleQuestions[2],
        document_id: 2,
        last_wrong_answer: 'C',
        last_wrong_at: Date.now(),
        document_title: '历史简答',
        document_file_type: 'docx',
      },
    ],
  });
  await page.goto('/#/wrong');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/wrongbook-round3.png`, fullPage: true });
});