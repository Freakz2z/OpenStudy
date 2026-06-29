import type { Page } from '@playwright/test';
import type {
  AppSettings,
  Document,
  IdentifyLogEntry,
  Question,
  WrongQuestion,
} from '../../src/shared/types';
import { DEFAULT_SHORTCUTS } from '../../src/shared/shortcuts';

export type { WrongQuestion };

export type ApiOverrides = Partial<Record<string, string>>;

export async function installApiMock(
  page: Page,
  opts: {
    documents?: Document[];
    questions?: Question[];
    wrong?: WrongQuestion[];
    logs?: IdentifyLogEntry[];
    settings?: AppSettings;
    overrides?: ApiOverrides;
  } = {},
): Promise<void> {
  const settings: AppSettings = opts.settings ?? {
    llm: {
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
    },
    shortcuts: DEFAULT_SHORTCUTS,
  };
  const o = opts.overrides ?? {};

  // 一次性 init script：先建对象，再依次应用（按 overrides 覆盖特定方法）
  await page.addInitScript(
    ({ settings, documents, questions, wrong, logs, overrides }) => {
      // 默认中文（覆盖任何用户偏好，保证测试稳定）
      try {
        localStorage.setItem(
          'openstudy-prefs',
          JSON.stringify({ theme: 'system', lang: 'zh' }),
        );
      } catch {}
      const w = window as unknown as {
        api: Record<string, (...args: any[]) => any>;
        __testHooks: {
          identifyCalls: number[];
          lastIdentifyDocId: number | null;
          progressListeners: Array<(p: unknown) => void>;
        };
      };
      w.__testHooks = {
        identifyCalls: [],
        lastIdentifyDocId: null,
        progressListeners: [],
      };

      const normalizeChoiceAnswer = (value: string) =>
        [...value.toUpperCase().replace(/[^A-Z]/g, '')].sort().join('');

      const normalizeFillAnswer = (value: string) =>
        value.replace(/[\s　，。、,.；;：:！!？?'''""]/g, '').toLowerCase();

      const stripParticles = (value: string) => value.replace(/[的了着过]/g, '');

      const localGradeAnswer = (
        question: { type: string; answer: string; options?: string[] | null },
        userAnswer: string,
      ) => {
        const answer = userAnswer.trim();
        if (!answer) {
          return {
            isCorrect: false,
            reason: '答案为空。',
            mode: 'fallback',
          };
        }

        if (question.type === 'choice' || question.type === 'multiple' || question.type === 'judge') {
          const ok = normalizeChoiceAnswer(answer) === normalizeChoiceAnswer(question.answer);
          return {
            isCorrect: ok,
            reason: ok ? '答案正确。' : '答案错误。',
            mode: 'fallback',
          };
        }

        if (question.type === 'fill') {
          const ok = normalizeFillAnswer(answer) === normalizeFillAnswer(question.answer);
          return {
            isCorrect: ok,
            reason: ok ? '答案与参考答案一致。' : '答案与参考答案差异较大。',
            mode: 'fallback',
          };
        }

        const keywords = question.answer
          .split(/[，。、,.；; \n]+/)
          .map((item: string) => item.trim())
          .filter((item: string) => item.length >= 2);

        if (keywords.length === 0) {
          const ok = stripParticles(answer).toLowerCase()
            .includes(stripParticles(question.answer).toLowerCase());
          return {
            isCorrect: ok,
            reason: ok ? '答案覆盖了参考答案。' : '答案未覆盖参考答案。',
            mode: 'fallback',
          };
        }

        const normalizedUserAnswer = stripParticles(answer).toLowerCase();
        const hitCount = keywords.filter((keyword: string) =>
          normalizedUserAnswer.includes(stripParticles(keyword).toLowerCase()),
        ).length;
        const ok = hitCount >= 1 && hitCount / keywords.length >= 0.6;
        return {
          isCorrect: ok,
          reason: ok ? '答案覆盖了参考答案的关键要点。' : '答案未充分覆盖参考答案的关键要点。',
          mode: 'fallback',
        };
      };

      const noop = () => Promise.resolve({ ok: true });
      w.api = {
        ping: () => Promise.resolve('pong'),
        getSettings: () => Promise.resolve(settings),
        updateSettings: (s: AppSettings) => {
          (window as unknown as { __lastSavedSettings: AppSettings }).__lastSavedSettings = s;
          return Promise.resolve(s);
        },
        importFile: () => Promise.resolve(null),
        listDocuments: () => Promise.resolve(documents),
        deleteDocument: noop,
        checkScannedPdf: () =>
          Promise.resolve({ scanned: false, avgCharsPerPage: 500, pageCount: 1 }),
        identifyQuestions: (docId: number) => {
          w.__testHooks.identifyCalls.push(docId);
          w.__testHooks.lastIdentifyDocId = docId;
          return Promise.resolve([]);
        },
        listIdentifyLogs: () => Promise.resolve(logs),
        deleteIdentifyLog: noop,
        clearIdentifyLogs: noop,
        getQuestionsByDocument: (docId: number) =>
          Promise.resolve(questions.filter((q) => q.document_id === docId)),
        updateQuestion: noop,
        onIdentifyProgress: (cb: (p: unknown) => void) => {
          w.__testHooks.progressListeners.push(cb);
          return () => {
            const i = w.__testHooks.progressListeners.indexOf(cb);
            if (i >= 0) w.__testHooks.progressListeners.splice(i, 1);
          };
        },
        saveAttempt: noop,
        listAttemptsByDocument: () => Promise.resolve([]),
        listRecentAttempts: () => Promise.resolve([]),
        listWrongQuestions: () => Promise.resolve(wrong),
        removeWrongQuestion: noop,
        clearWrongBook: noop,
        resetDocumentProgress: () => Promise.resolve({ ok: true, removed: 0 }),
        getMarkdown: () =>
          Promise.resolve({ markdown: '# 测试 Markdown\n\n内容', source: 'fresh' as const }),
        saveMarkdown: noop,
        askPracticeQuestion: () => Promise.resolve('这是测试环境下的 AI 回复。'),
        gradePracticeAnswer: (payload: {
          question: { type: string; answer: string; options?: string[] | null };
          userAnswer: string;
        }) => Promise.resolve(localGradeAnswer(payload.question, payload.userAnswer)),
        testModel: () =>
          Promise.resolve({
            ok: true,
            provider: settings.llm.provider,
            model: settings.llm.model,
            latencyMs: 42,
            message: '模型连接正常',
          }),
        generateStudyInsights: () =>
          Promise.resolve({
            summary: '近期练习节奏稳定。',
            highlights: ['基础题型掌握较稳定'],
            risks: ['主观题仍需更多练习'],
            actions: ['继续保持每日练习'],
          }),
        getDocumentStats: (docId: number) => {
          const docQuestions = questions.filter((q) => q.document_id === docId);
          const qids = new Set(docQuestions.map((q) => q.id));
          const wrongQids = new Set(wrong.filter((q) => q.document_id === docId).map((q) => q.id));
          let correct = 0;
          let attempted = 0;
          for (const id of qids) {
            if (wrongQids.has(id)) {
              attempted++;
            } else if (wrong.length > 0) {
              // 默认：题目没出现在错题本且没有显式 attempt 记录视为 0；测试用更直接的样例
            }
          }
          return Promise.resolve({
            question_count: docQuestions.length,
            attempted_count: wrongQids.size,
            correct_count: 0,
            wrong_count: wrongQids.size,
            accuracy: null,
          });
        },
        getOverallStats: () => {
          const wrongDocIds = new Set(wrong.map((w) => w.document_id));
          const docIds = new Set(documents.map((d) => d.id));
          const totalQ = questions.length;
          return Promise.resolve({
            document_count: documents.length,
            question_count: totalQ,
            attempted_count: wrongDocIds.size,
            wrong_count: wrong.length,
            accuracy: null,
          });
        },
      };

      // 应用 overrides（按字符串源码求值后覆盖 api 上的方法）
      for (const [k, src] of Object.entries(overrides)) {
        if (src && k in w.api) {
          try {
            // eslint-disable-next-line no-new-func
            const factory = new Function(
              'return async function(...args) { return (' + src + ').apply(null, args); }',
            );
            w.api[k] = factory() as never;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('override failed for', k, e);
          }
        }
      }
    },
    {
      settings,
      documents: opts.documents ?? [],
      questions: opts.questions ?? [],
      wrong: opts.wrong ?? [],
      logs: opts.logs ?? [],
      overrides: o,
    },
  );
}

export const sampleDocs: Document[] = [
  {
    id: 1,
    file_path: '/Users/test/algebra.pdf',
    file_type: 'pdf',
    title: '代数练习题',
    imported_at: Date.now() - 86400000,
    question_count: 0,
  },
  {
    id: 2,
    file_path: '/Users/test/history.docx',
    file_type: 'docx',
    title: '历史简答',
    imported_at: Date.now() - 3600000,
    question_count: 5,
  },
];

export const sampleQuestions: Question[] = [
  {
    id: 101,
    document_id: 2,
    type: 'choice',
    stem: '中国的首都是？',
    options: ['A. 上海', 'B. 北京', 'C. 广州', 'D. 深圳'],
    answer: 'B',
    explanation: '北京是中华人民共和国的首都。',
    page_or_section: null,
    position: 0,
  },
  {
    id: 102,
    document_id: 2,
    type: 'fill',
    stem: '《静夜思》的作者是___。',
    options: null,
    answer: '李白',
    explanation: null,
    page_or_section: null,
    position: 1,
  },
  {
    id: 103,
    document_id: 2,
    type: 'short',
    stem: '简述工业革命的影响。',
    options: null,
    answer: '促进 生产力 城市化',
    explanation: '工业革命推动了生产力的飞跃。',
    page_or_section: null,
    position: 2,
  },
];

export const sampleWrong: WrongQuestion[] = [
  {
    ...sampleQuestions[0],
    last_wrong_answer: 'A',
    last_wrong_at: Date.now() - 1000,
    document_title: '历史简答',
    document_file_type: 'docx',
  },
];
