import { test } from '@playwright/test';
import { installApiMock } from './_helpers';
import * as fs from 'node:fs';
import type { Question } from '../../src/shared/types';

const SHOTS = 'test-results/visual';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const choice = (
  letter: string,
  text: string,
  options: string[] = [],
): Question => ({
  id: Math.floor(Math.random() * 100000),
  document_id: 1,
  type: 'choice',
  stem: '示例题（选项文字很长）',
  options,
  answer: letter,
  explanation: null,
  page_or_section: null,
  position: 0,
});

const trickyQuestions: Question[] = [
  choice('A', '短', [
    '普通短选项',
    '另一段超长文字——用来测试容器是否能正确展开而不被裁剪——如果容器不滚动或 white-space:nowrap 会被截断；我们的容器应该完整显示所有选项文字内容。',
    'C 较短',
    'D',
  ]),
  choice('B', '代码题', [
    'A. 使用 简单字符串',
    'B. const result = await fetch(url).then(r => r.json());',
    'C. function add(a, b) { return a + b; }',
    'D. class MyClass extends Base {\n  constructor() {\n    super();\n    this.x = 1;\n  }\n}',
  ]),
  choice('C', '混合', [
    'A. 普通',
    'B. 短代码：npm install',
    'C. await fetch("https://api.example.com/users/12345").then((res) => res.json()).then((data) => console.log(data))',
    'D. console.log("hello")',
  ]),
  {
    ...choice('D', '代码填空', ['return ___;']),
    type: 'fill',
  },
  choice('A', '极长单行', [
    'https://api.example.com/v1/very/long/path/to/resource?param1=value1&param2=value2&param3=value3&param4=value4&param5=value5',
    '短选项 2',
    'function veryLongFunctionName(arg1, arg2, arg3, arg4, arg5, arg6) { return arg1 + arg2 + arg3 + arg4 + arg5 + arg6; }',
    '短选项 4',
  ]),
];

test('选项溢出视觉诊断', async ({ page }) => {
  await page.exposeFunction('__getQs', () => trickyQuestions);
  await installApiMock(page, {
    documents: [
      {
        id: 1,
        file_path: '/tmp/x',
        file_type: 'pdf',
        title: 'test',
        imported_at: 0,
        question_count: 5,
      },
    ],
    questions: trickyQuestions,
  });
  await page.goto('/#/practice/1');
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${SHOTS}/option-overflow.png`,
    fullPage: true,
  });

  // 点选 B 选项 → 看 is-selected 视觉
  await page.locator('.practice-option').nth(1).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${SHOTS}/option-selected.png`,
    fullPage: true,
  });

  // 展开 AI 提问面板
  const askToggle = page.locator('.practice-ai-toggle').first();
  if (await askToggle.isVisible().catch(() => false)) {
    await askToggle.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${SHOTS}/ask-expanded.png`,
      fullPage: true,
    });
  }

  const m = await page.evaluate(() => {
    const opts = document.querySelectorAll('.practice-option');
    return [...opts].map((o) => {
      const text = (o.textContent || '').trim();
      const cs = getComputedStyle(o);
      return {
        text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
        height: o.getBoundingClientRect().height,
        whiteSpace: cs.whiteSpace,
        isSelected: o.classList.contains('is-selected'),
      };
    });
  });
  console.log('OPTIONS:', JSON.stringify(m, null, 2));
});
