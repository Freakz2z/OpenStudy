import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const cwd = process.cwd();
const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;
const tmpDir = path.join(cwd, '.tmp', 'readme-workflow');
const outputPath = path.join(cwd, '.github', 'assets', 'openstudy-workflow.gif');

const sampleMarkdown = `# Backend Interview Pack

## Multiple Choice

### 1. Which HTTP method is typically idempotent for updating a resource?

- A. POST
- B. PATCH
- C. PUT
- D. CONNECT

Type: choice
Answer: C
Explanation: PUT is defined as idempotent when replacing the resource representation.

## Fill in the Blank

### 1. In distributed systems, a process that coordinates access to shared state is often called a ___.

Type: fill
Answer: coordinator
Explanation: Coordinator is a common generic term for the process that manages shared state access.

## Short Answer

### 1. Briefly explain why retries without idempotency can be dangerous.

Type: short
Answer: duplicate side effects inconsistent state repeated writes
Explanation: Retries can trigger repeated writes or side effects when the action is not idempotent.

## Code Analysis

### 1. Read the code below. Which description is correct?

\`\`\`java
@WebMvcTest(UserController.class)
public class UserApiTest {
    @Autowired
    private MockMvc mockMvc;
}
\`\`\`

- A. It loads every Spring bean
- B. It is used for controller slice testing
- C. It automatically launches a browser
- D. It is only used for database migration

Type: code
Answer: B
Explanation: @WebMvcTest is used for controller slice testing.
`;

const importedDocument = {
  id: 2,
  file_path: '/Users/demo/backend-interview-pack.md',
  file_type: 'md',
  title: 'Backend Interview Pack',
  imported_at: Date.now(),
  question_count: 4,
};

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
    document_id: 2,
    type: 'code',
    stem: 'Read the code below. Which description is correct?',
    options: [
      'A. It loads every Spring bean',
      'B. It is used for controller slice testing',
      'C. It automatically launches a browser',
      'D. It is only used for database migration',
    ],
    answer: 'B',
    explanation: '@WebMvcTest is used for controller slice testing.',
    page_or_section: 'Spring testing',
    position: 3,
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
    practiceRevealAnswer: { key: 'Space' },
    practiceOptionPrev: { key: 'ArrowUp' },
    practiceOptionNext: { key: 'ArrowDown' },
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    await sleep(400);
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
    ({ importedDocument, questions, settings, sampleMarkdown }) => {
      try {
        localStorage.setItem(
          'openstudy-prefs',
          JSON.stringify({ theme: 'light', lang: 'en' }),
        );
      } catch {}

      const docs = [];
      const wrongQuestions = [];
      const attempts = [];
      const markdownByDoc = {};

      const localGradeAnswer = (question, userAnswer) => {
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
      };

      const buildStats = (docId) => {
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
        updateSettings: (nextSettings) => Promise.resolve(nextSettings),
        importFile: async () => {
          await new Promise((resolve) => setTimeout(resolve, 450));
          if (!docs.some((item) => item.id === importedDocument.id)) {
            docs.push({ ...importedDocument, imported_at: Date.now() });
            markdownByDoc[importedDocument.id] = sampleMarkdown;
          }
          return docs[0];
        },
        listDocuments: () => Promise.resolve(docs.map((item) => ({ ...item }))),
        deleteDocument: () => Promise.resolve({ ok: true }),
        checkScannedPdf: () =>
          Promise.resolve({ scanned: false, avgCharsPerPage: 400, pageCount: 1 }),
        identifyQuestions: (docId) =>
          Promise.resolve(questions.filter((item) => item.document_id === docId)),
        listIdentifyLogs: () => Promise.resolve([]),
        deleteIdentifyLog: () => Promise.resolve({ ok: true }),
        clearIdentifyLogs: () => Promise.resolve({ ok: true }),
        getQuestionsByDocument: (docId) =>
          Promise.resolve(questions.filter((item) => item.document_id === docId)),
        updateQuestion: () => Promise.resolve({ ok: true }),
        onIdentifyProgress: () => () => {},
        saveAttempt: (questionId, userAnswer, isCorrect) => {
          const question = questions.find((item) => item.id === questionId);
          if (!question) return Promise.resolve({ ok: false });

          const existingAttemptIndex = attempts.findIndex((item) => item.question_id === questionId);
          const attemptRecord = {
            question_id: questionId,
            document_id: question.document_id,
            document_title: importedDocument.title,
            question_type: question.type,
            question_stem: question.stem,
            reference_answer: question.answer,
            user_answer: userAnswer,
            is_correct: isCorrect,
            attempted_at: Date.now(),
          };
          if (existingAttemptIndex >= 0) attempts.splice(existingAttemptIndex, 1, attemptRecord);
          else attempts.push(attemptRecord);

          const wrongIndex = wrongQuestions.findIndex((item) => item.id === questionId);
          if (isCorrect) {
            if (wrongIndex >= 0) wrongQuestions.splice(wrongIndex, 1);
          } else {
            const wrongEntry = {
              ...question,
              last_wrong_answer: userAnswer,
              last_wrong_at: Date.now(),
              document_title: importedDocument.title,
              document_file_type: importedDocument.file_type,
            };
            if (wrongIndex >= 0) wrongQuestions.splice(wrongIndex, 1, wrongEntry);
            else wrongQuestions.push(wrongEntry);
          }
          return Promise.resolve({ ok: true });
        },
        listAttemptsByDocument: (docId) =>
          Promise.resolve(attempts.filter((item) => item.document_id === docId)),
        listRecentAttempts: () =>
          Promise.resolve([...attempts].sort((a, b) => b.attempted_at - a.attempted_at)),
        listWrongQuestions: () => Promise.resolve(wrongQuestions.map((item) => ({ ...item }))),
        removeWrongQuestion: (questionId) => {
          const index = wrongQuestions.findIndex((item) => item.id === questionId);
          if (index >= 0) wrongQuestions.splice(index, 1);
          return Promise.resolve({ ok: true });
        },
        clearWrongBook: () => {
          wrongQuestions.splice(0, wrongQuestions.length);
          return Promise.resolve({ ok: true });
        },
        resetDocumentProgress: (docId) => {
          for (let index = attempts.length - 1; index >= 0; index -= 1) {
            if (attempts[index].document_id === docId) attempts.splice(index, 1);
          }
          for (let index = wrongQuestions.length - 1; index >= 0; index -= 1) {
            if (wrongQuestions[index].document_id === docId) wrongQuestions.splice(index, 1);
          }
          return Promise.resolve({ ok: true, removed: 0 });
        },
        getMarkdown: (docId) =>
          Promise.resolve({ markdown: markdownByDoc[docId] ?? sampleMarkdown, source: 'db' }),
        saveMarkdown: (docId, markdown) => {
          markdownByDoc[docId] = markdown;
          return Promise.resolve({ ok: true });
        },
        askPracticeQuestion: async (_payload) => {
          await new Promise((resolve) => setTimeout(resolve, 450));
          return 'This question is testing idempotency. PUT can be repeated without creating extra side effects when the same resource representation is sent again.';
        },
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
        generateStudyInsights: async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return {
            summary:
              'You are building good momentum, but API behavior and testing semantics still need one more focused review.',
            highlights: [
              'Practice activity is steady after import.',
              'You are using Ask AI in context instead of breaking flow.',
            ],
            risks: [
              'A wrong answer on idempotency suggests concept recall is still uneven.',
            ],
            actions: [
              'Redo the current wrong-book entry once more today.',
              'Write a one-line contrast between PUT and PATCH.',
            ],
          };
        },
        getDocumentStats: (docId) => Promise.resolve(buildStats(docId)),
        getOverallStats: () => {
          const allAttempts = attempts.length;
          const correctCount = attempts.filter((item) => item.is_correct).length;
          return Promise.resolve({
            document_count: docs.length,
            question_count: questions.length,
            attempted_count: allAttempts,
            wrong_count: wrongQuestions.length,
            accuracy: allAttempts ? correctCount / allAttempts : null,
          });
        },
      };
    },
    { importedDocument, questions, settings, sampleMarkdown },
  );
}

async function runFfmpeg(inputPath, outputGifPath) {
  await ensureDir(path.dirname(outputGifPath));
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-ss',
      '0.8',
      '-i',
      inputPath,
      '-filter_complex',
      'fps=10,scale=1200:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5',
      outputGifPath,
    ], {
      cwd,
      stdio: 'ignore',
    });
    ffmpeg.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    ffmpeg.on('error', reject);
  });
}

async function captureGif() {
  await fs.rm(tmpDir, { recursive: true, force: true });
  await ensureDir(tmpDir);

  const server = createServerProcess();
  const browser = await chromium.launch({ headless: true });
  let videoPath = null;

  try {
    await waitForServer(baseUrl);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 832 },
      recordVideo: {
        dir: tmpDir,
        size: { width: 1280, height: 832 },
      },
    });

    const page = await context.newPage();
    const video = page.video();
    await installMock(page);

    await page.goto(`${baseUrl}/#/library`, { waitUntil: 'networkidle' });
    await sleep(900);

    await page.getByRole('button', { name: 'Import Document' }).click();
    await sleep(1400);

    await page.getByRole('button', { name: 'Edit File' }).click();
    await sleep(1200);
    await page.getByRole('button', { name: 'Back' }).click();
    await sleep(700);

    await page.getByRole('button', { name: 'Practice' }).click();
    await sleep(1000);

    await page.locator('label').filter({ hasText: 'A. POST' }).click();
    await sleep(350);
    await page.getByRole('button', { name: 'Submit' }).click();
    await sleep(750);

    await page.locator('.practice-ai-toggle').click();
    await page.waitForSelector('.practice-ai-composer textarea');
    await page.locator('.practice-ai-composer textarea').fill('What concept is this testing?');
    await sleep(250);
    await page.locator('.practice-ai-send').click();
    await sleep(1400);

    await page.getByRole('link', { name: 'Wrong Book' }).click();
    await sleep(900);
    await page.getByRole('button', { name: /Backend Interview Pack/ }).click();
    await sleep(900);
    await page.getByRole('button', { name: 'Redo' }).click();
    await sleep(900);

    await page.locator('label').filter({ hasText: 'C. PUT' }).click();
    await sleep(300);
    await page.getByRole('button', { name: 'Submit' }).click();
    await sleep(800);

    await page.getByRole('link', { name: 'Insights' }).click();
    await sleep(900);
    await page.getByRole('button', { name: 'Analyze insights' }).click();
    await sleep(1800);

    await context.close();
    videoPath = await video.path();
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  if (!videoPath) {
    throw new Error('Workflow video path was not created.');
  }

  await runFfmpeg(videoPath, outputPath);
  await fs.rm(tmpDir, { recursive: true, force: true });
  console.log(`Created workflow GIF at ${outputPath}`);
}

await captureGif();
