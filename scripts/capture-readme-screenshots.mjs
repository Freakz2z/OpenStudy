import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const cwd = process.cwd();
const port = 4173;
const baseUrl = `http://127.0.0.1:${port}`;
const outputDir = path.join(cwd, '.github', 'assets', 'screenshots');

const documents = [
  {
    id: 1,
    file_path: '/Users/demo/system-design-sprint.md',
    file_type: 'md',
    title: 'System Design Sprint',
    imported_at: Date.now() - 1000 * 60 * 60 * 24 * 2,
    question_count: 12,
  },
  {
    id: 2,
    file_path: '/Users/demo/backend-interview-pack.md',
    file_type: 'md',
    title: 'Backend Interview Pack',
    imported_at: Date.now() - 1000 * 60 * 60 * 6,
    question_count: 18,
  },
  {
    id: 3,
    file_path: '/Users/demo/distributed-systems-review.md',
    file_type: 'md',
    title: 'Distributed Systems Review',
    imported_at: Date.now() - 1000 * 60 * 40,
    question_count: 9,
  },
];

const questions = [
  {
    id: 201,
    document_id: 2,
    type: 'choice',
    stem: 'Which HTTP method is typically idempotent for updating a resource?',
    options: ['A. POST', 'B. PATCH', 'C. PUT', 'D. CONNECT'],
    answer: 'C',
    explanation: 'PUT is defined as idempotent when replacing the resource representation.',
    page_or_section: 'REST fundamentals',
    position: 0,
  },
  {
    id: 202,
    document_id: 2,
    type: 'fill',
    stem: 'In distributed systems, a process that coordinates access to shared state is often called a ___.',
    options: null,
    answer: 'coordinator',
    explanation: 'Coordinator is a common generic term for the process that manages shared state access.',
    page_or_section: 'Coordination',
    position: 1,
  },
  {
    id: 203,
    document_id: 2,
    type: 'short',
    stem: 'Briefly explain why retries without idempotency can be dangerous.',
    options: null,
    answer: 'duplicate side effects inconsistent state repeated writes',
    explanation: 'Retries can trigger repeated writes or side effects when the action is not idempotent.',
    page_or_section: 'Reliability',
    position: 2,
  },
  {
    id: 204,
    document_id: 3,
    type: 'code',
    stem: 'What is the testing purpose of this Spring Boot annotation?',
    options: [
      'A. Loads every Spring bean for full integration',
      'B. Narrows the context to MVC components',
      'C. Starts a browser automatically',
      'D. Only runs database migrations',
    ],
    answer: 'B',
    explanation: '@WebMvcTest is intended for controller-layer slice tests.',
    page_or_section: 'Spring testing',
    position: 0,
  },
];

const wrongQuestions = [
  {
    ...questions[0],
    last_wrong_answer: 'A',
    last_wrong_at: Date.now() - 1000 * 60 * 12,
    document_title: 'Backend Interview Pack',
    document_file_type: 'md',
  },
  {
    ...questions[3],
    last_wrong_answer: 'A',
    last_wrong_at: Date.now() - 1000 * 60 * 40,
    document_title: 'Distributed Systems Review',
    document_file_type: 'md',
  },
];

const attempts = [
  {
    question_id: 201,
    document_id: 2,
    document_title: 'Backend Interview Pack',
    question_type: 'choice',
    question_stem: questions[0].stem,
    reference_answer: questions[0].answer,
    user_answer: 'A',
    is_correct: false,
    attempted_at: Date.now() - 1000 * 60 * 10,
  },
  {
    question_id: 202,
    document_id: 2,
    document_title: 'Backend Interview Pack',
    question_type: 'fill',
    question_stem: questions[1].stem,
    reference_answer: questions[1].answer,
    user_answer: 'coordinator',
    is_correct: true,
    attempted_at: Date.now() - 1000 * 60 * 55,
  },
  {
    question_id: 203,
    document_id: 2,
    document_title: 'Backend Interview Pack',
    question_type: 'short',
    question_stem: questions[2].stem,
    reference_answer: questions[2].answer,
    user_answer: 'It can repeat side effects and create inconsistent state.',
    is_correct: true,
    attempted_at: Date.now() - 1000 * 60 * 90,
  },
  {
    question_id: 204,
    document_id: 3,
    document_title: 'Distributed Systems Review',
    question_type: 'code',
    question_stem: questions[3].stem,
    reference_answer: questions[3].answer,
    user_answer: 'A',
    is_correct: false,
    attempted_at: Date.now() - 1000 * 60 * 120,
  },
];

const settings = {
  llm: {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
  },
  shortcuts: {
    practiceSubmit: { key: 'Enter' },
    practiceNext: { key: 'Enter' },
    practicePrev: { key: 'ArrowLeft' },
    practiceOptionPrev: { key: 'ArrowUp' },
    practiceOptionNext: { key: 'ArrowDown' },
  },
};

function localGradeAnswer(question, userAnswer) {
  const answer = userAnswer.trim();
  if (!answer) {
    return { isCorrect: false, reason: 'Answer is empty.', mode: 'fallback' };
  }

  if (question.type === 'choice' || question.type === 'multiple' || question.type === 'judge') {
    const ok = answer.toUpperCase().replace(/[^A-Z]/g, '') === question.answer.toUpperCase();
    return { isCorrect: ok, reason: ok ? 'Correct answer.' : 'Incorrect answer.', mode: 'fallback' };
  }

  if (question.type === 'fill') {
    const ok = answer.trim().toLowerCase() === question.answer.trim().toLowerCase();
    return {
      isCorrect: ok,
      reason: ok ? 'Matches the reference answer.' : 'Does not match the reference answer.',
      mode: 'fallback',
    };
  }

  const referenceWords = question.answer
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const normalized = answer.toLowerCase();
  const hitCount = referenceWords.filter((word) => normalized.includes(word)).length;
  const ok = hitCount >= Math.max(1, Math.ceil(referenceWords.length * 0.6));
  return {
    isCorrect: ok,
    reason: ok ? 'Covers the key ideas.' : 'Misses important key ideas.',
    mode: 'fallback',
  };
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve((res.statusCode ?? 500) < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function createServerProcess() {
  return spawn(path.join(cwd, 'node_modules', '.bin', 'vite'), [
    '--port',
    String(port),
    '--strictPort',
    '--host',
    '127.0.0.1',
  ], {
    cwd,
    stdio: 'ignore',
  });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function installMock(page) {
  await page.addInitScript(
    ({ documents, questions, wrongQuestions, attempts, settings }) => {
      try {
        localStorage.setItem(
          'openstudy-prefs',
          JSON.stringify({ theme: 'light', lang: 'en' }),
        );
      } catch {}

      const overallAccuracy = attempts.length
        ? attempts.filter((item) => item.is_correct).length / attempts.length
        : null;

      const getDocumentStats = (docId) => {
        const docQuestions = questions.filter((item) => item.document_id === docId);
        const docAttempts = attempts.filter((item) => item.document_id === docId);
        const correctCount = docAttempts.filter((item) => item.is_correct).length;
        const wrongCount = docAttempts.filter((item) => !item.is_correct).length;
        return {
          question_count: docQuestions.length,
          attempted_count: docAttempts.length,
          correct_count: correctCount,
          wrong_count: wrongCount,
          accuracy: docAttempts.length ? correctCount / docAttempts.length : null,
        };
      };

      window.api = {
        ping: () => Promise.resolve('pong'),
        getSettings: () => Promise.resolve(settings),
        updateSettings: (next) => Promise.resolve(next),
        importFile: () => Promise.resolve(null),
        listDocuments: () => Promise.resolve(documents),
        deleteDocument: () => Promise.resolve({ ok: true }),
        checkScannedPdf: () =>
          Promise.resolve({ scanned: false, avgCharsPerPage: 560, pageCount: 18 }),
        identifyQuestions: () => Promise.resolve([]),
        listIdentifyLogs: () => Promise.resolve([]),
        deleteIdentifyLog: () => Promise.resolve({ ok: true }),
        clearIdentifyLogs: () => Promise.resolve({ ok: true }),
        getQuestionsByDocument: (docId) =>
          Promise.resolve(questions.filter((item) => item.document_id === docId)),
        updateQuestion: () => Promise.resolve({ ok: true }),
        onIdentifyProgress: () => () => {},
        saveAttempt: () => Promise.resolve({ ok: true }),
        listAttemptsByDocument: (docId) =>
          Promise.resolve(
            attempts
              .filter((item) => item.document_id === docId)
              .map(({ question_id, user_answer, is_correct, attempted_at }) => ({
                question_id,
                user_answer,
                is_correct,
                attempted_at,
              })),
          ),
        listRecentAttempts: (limit = 20) => Promise.resolve(attempts.slice(0, limit)),
        listWrongQuestions: () => Promise.resolve(wrongQuestions),
        removeWrongQuestion: () => Promise.resolve({ ok: true }),
        clearWrongBook: () => Promise.resolve({ ok: true }),
        resetDocumentProgress: () => Promise.resolve({ ok: true, removed: 2 }),
        getMarkdown: () =>
          Promise.resolve({
            markdown: '# OpenStudy Demo\n\n- Structured questions\n- Wrong-book review\n- AI coaching',
            source: 'fresh',
          }),
        saveMarkdown: () => Promise.resolve({ ok: true }),
        askPracticeQuestion: () =>
          Promise.resolve(
            'This question checks your understanding of idempotency and API design. Focus on repeated requests and side effects.',
          ),
        gradePracticeAnswer: (payload) =>
          Promise.resolve(localGradeAnswer(payload.question, payload.userAnswer)),
        testModel: () =>
          Promise.resolve({
            ok: true,
            provider: settings.llm.provider,
            model: settings.llm.model,
            latencyMs: 41,
            message: 'Model connection looks healthy.',
          }),
        generateStudyInsights: () =>
          Promise.resolve({
            summary:
              'You are doing well on short-answer reasoning, but still leaking points on API semantics and testing details.',
            highlights: [
              'Recent short-answer responses are concise and cover key concepts.',
              'Your study cadence is steady across multiple documents.',
            ],
            risks: [
              'Choice questions about API behavior and Spring testing still produce avoidable mistakes.',
              'A few wrong answers suggest memorization is outrunning understanding.',
            ],
            actions: [
              'Rework the current wrong-book once before importing new material.',
              'Write one-line explanations for each mistaken option to strengthen recall.',
            ],
          }),
        getDocumentStats: (docId) => Promise.resolve(getDocumentStats(docId)),
        getOverallStats: () =>
          Promise.resolve({
            document_count: documents.length,
            question_count: questions.length,
            attempted_count: attempts.length,
            wrong_count: wrongQuestions.length,
            accuracy: overallAccuracy,
          }),
      };
    },
    { documents, questions, wrongQuestions, attempts, settings },
  );
}

async function capture() {
  await ensureDir(outputDir);

  const server = createServerProcess();
  const browser = await chromium.launch({ headless: true });

  try {
    await waitForServer(baseUrl);

    const context = await browser.newContext({
      viewport: { width: 1600, height: 1040 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();
    await installMock(page);

    await page.goto(`${baseUrl}/#/library`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(outputDir, 'openstudy-library.png'),
      fullPage: false,
    });

    await page.goto(`${baseUrl}/#/practice/2`, { waitUntil: 'networkidle' });
    await page.locator('label').filter({ hasText: 'C. PUT' }).click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.locator('.practice-ai-toggle').click();
    await page.waitForSelector('.practice-ai-composer textarea');
    await page.locator('.practice-ai-composer textarea').fill('What concept is this testing?');
    await page.locator('.practice-ai-send').click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(outputDir, 'openstudy-practice.png'),
      fullPage: false,
    });

    await page.goto(`${baseUrl}/#/insights`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Analyze insights' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(outputDir, 'openstudy-insights.png'),
      fullPage: false,
    });

    await context.close();
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

await capture();
