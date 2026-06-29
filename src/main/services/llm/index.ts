import { z } from 'zod';
import JSON5 from 'json5';
import type {
  ExtractedQuestion,
  ModelTestRequest,
  ModelTestResult,
  PracticeAskRequest,
  PracticeGradeRequest,
  PracticeGradeResult,
  StudyInsightsRequest,
  StudyInsightsResult,
  StudyChatMessage,
} from '../../../shared/types.js';
import {
  isOptionQuestion,
  normalizeChoiceAnswer,
  normalizeChoiceOptions,
} from '../../../shared/question-format.js';
import { localGradeAnswer } from '../../../shared/practice-grading.js';
import { applyLLMProviderDefaults } from '../../../shared/llm-provider-presets.js';
import { getSettings } from '../store.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { DeepSeekProvider } from './deepseek.js';
import { OpenAICompatProvider } from './openai-compat.js';

export const ExtractedQuestionSchema = z.object({
  source_id: z.string().nullish().transform((s) => s ?? undefined),
  type: z.string().transform(normalizeType),
  stem: z.string().nullish().transform((s) => s ?? ''),
  options: z
    .union([z.array(z.string()), z.string(), z.null()])
    .optional()
    .transform(normalizeOptions),
  // answer 允许 null/缺失——遇到不完整的题目（被 max_tokens 截断）由 salvageQuestions 过滤
  answer: z
    .union([z.string(), z.null()])
    .nullish()
    .transform((s) => s ?? null),
  explanation: z.string().nullish(),
  page_or_section: z.string().nullish(),
});

function normalizeType(t: string): 'choice' | 'multiple' | 'judge' | 'fill' | 'short' | 'code' {
  const s = t.trim().toLowerCase();
  if (s.includes('multiple') || s.includes('multi_choice') || s.includes('多选') || s.includes('多项选择'))
    return 'multiple';
  if (s.includes('judge') || s.includes('true_false') || s.includes('判断') || s.includes('是非'))
    return 'judge';
  if (s.includes('choice') || s.includes('选择') || s === 'mc' || s === 'mcq' || s === '单选' || s === '多选')
    return 'choice';
  if (s.includes('fill') || s.includes('blank') || s.includes('填空')) return 'fill';
  if (s.includes('code') || s.includes('program') || s.includes('代码')) return 'code';
  return 'short';
}

function normalizeOptions(
  o: string[] | string | null | undefined,
): string[] | undefined {
  if (o == null) return undefined;
  if (Array.isArray(o)) {
    const normalized = normalizeChoiceOptions(o.map((s) => String(s)));
    return normalized ?? undefined;
  }
  // 字符串形式："A. xxx\nB. yyy"
  const parts = o
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const normalized = normalizeChoiceOptions(parts);
  return normalized ?? undefined;
}

export const ExtractedQuestionListSchema = z.object({
  questions: z.array(ExtractedQuestionSchema),
});

export interface LLMInput {
  text?: string;
  images?: Array<{ base64: string; mime: string; page: number }>;
  hint?: string;
}

export interface LLMProvider {
  identifyQuestions(input: LLMInput): Promise<ExtractedQuestion[]>;
}

const STUDY_CHAT_SYSTEM_PROMPT = `你是 OpenStudy 的做题助教。

你的任务是围绕当前题目回答学生问题，帮助他理解考点、思路、易错点与答案依据。

规则：
1. 直接回答问题，优先讲“为什么”与“怎么做”。
2. 如果学生已经作答，要结合他的答案指出错因或不足。
3. 只基于题目上下文回答；如果题目本身信息不足，要明确说明。
4. 语言保持和学生一致，默认用中文。
5. 表达简洁、清楚、耐心，适合做题场景。`;

const PRACTICE_GRADE_SYSTEM_PROMPT = `你是 OpenStudy 的主观题判分器。

任务：判断学生答案与参考答案是否语义正确或足够接近，适用于填空题、简答题、代码分析题等主观题。

输出要求：
1. 只能输出一个合法 JSON 对象，禁止输出 Markdown、解释文字或代码块。
2. JSON 结构固定为：
{"isCorrect":true,"reason":"一句到两句的简短中文说明"}

判分规则：
1. 优先看语义是否正确，不要求与参考答案字面完全一致。
2. 填空题允许空格、标点、大小写、常见同义表达差异，但核心事实不能错。
3. 简答题只要覆盖关键要点且没有关键性错误，就可以判定正确。
4. 如果学生答案只答到一部分关键点，或出现明显事实错误，应判定错误。
5. reason 必须简洁、具体，适合直接展示给做题者。`;

const PracticeGradeResultSchema = z.object({
  isCorrect: z.boolean(),
  reason: z.string().transform((value) => value.trim()),
});

const StudyInsightsResultSchema = z.object({
  summary: z.string().transform((value) => value.trim()),
  highlights: z.array(z.string().transform((value) => value.trim())).default([]),
  risks: z.array(z.string().transform((value) => value.trim())).default([]),
  actions: z.array(z.string().transform((value) => value.trim())).default([]),
});

const STUDY_INSIGHTS_SYSTEM_PROMPT = `你是 OpenStudy 的学习分析助手。

你的任务是根据最近的做题记录，输出一份简洁、具体、可执行的学习洞察。

输出要求：
1. 只能输出合法 JSON，不要输出 Markdown、解释文字或代码块。
2. JSON 结构固定为：
{"summary":"...","highlights":["..."],"risks":["..."],"actions":["..."]}
3. 每个数组给出 2 到 4 条，语言跟随输入语言，默认中文。
4. 建议必须可执行，避免空泛鼓励。`;



// 选项内容反查：把"RNN"/"Transformer"等答案内容映射回选项字母"A"/"C"
function resolveAnswerByContent(
  answer: string,
  options: readonly string[] | null | undefined,
): string {
  const trimmed = (answer ?? '').trim();
  if (!trimmed || !options || options.length === 0) return trimmed;
  if (/^[A-Ha-h]+$/.test(trimmed)) return trimmed;  // 已经是纯字母
  const stripped = trimmed.replace(/^\s*[A-Ha-h][\.、:：)\]）]\s*/, '').trim();
  if (!stripped) return trimmed;
  for (let i = 0; i < options.length; i++) {
    const opt = (options[i] ?? '').trim();
    const optStripped = opt.replace(/^\s*[A-Ha-h][\.、:：)\]）]\s*/, '').trim();
    if (optStripped.toLowerCase() === stripped.toLowerCase()) {
      return String.fromCharCode(65 + i);
    }
  }
  return trimmed;
}
export const SYSTEM_PROMPT = `你是 OpenStudy 的题目提取器。识别材料中的题目，严格按 OpenStudy 标准格式输出 JSON。

【OpenStudy 标准】
1. 系统前一步会先把 PDF/Word/TXT 转成标准化 Markdown，再交给你做结构化。
2. 标准 Markdown 中，每道题优先用 Type: 字段声明题型，取值只能是：
   - choice / multiple / judge / fill / short / code
3. 章节标题是辅助信息，可选，若存在则使用以下形式之一，不带编号：
   - 中文: ## 单选题 / ## 多选题 / ## 判断题 / ## 填空题 / ## 简答题 / ## 代码题
   - English: ## Multiple Choice / ## Multiple Select / ## True or False / ## Fill in the Blank / ## Short Answer / ## Code Analysis
4. 标准 Markdown 的字段名统一为 ASCII 形式:
   - Type: ...
   - Answer: ...
   - Explanation: ...
5. 不要依赖中文括号标签、难度标签或“每题 X 分”说明行。

【OpenStudy 结构化题型 - 6 种题型】
1. 单选 (choice) / 多选 (multiple) / 判断 (judge) / 填空 (fill) / 简答 (short) / 代码分析 (code)
2. options 数组：每项必须以 "A. ", "B. ", "C. ", "D. " 开头（点号 + 空格）。
3. answer 字段：选择题只填单个字母（如 "A"），多选题写排序后的字母串（如 "ACD"），判断题固定 "A" 或 "B"。
4. 如果材料中答案以"选项内容"形式给出（如"答案：RNN"），必须先反查对应选项字母再写入 answer 字段。

【输出格式 - 严格遵守 json】
你的输出必须且只能是一个合法的 json 对象，不要任何解释、前言、后缀、Markdown 代码块。
json 顶层必须是对象，含 questions 数组。

格式样例（必须严格遵守结构）：
{
  "questions": [
    {
      "source_id": "q1",
      "type": "choice",
      "stem": "下列哪个是机器学习中的监督学习算法？",
      "options": ["A. K-Means", "B. 决策树", "C. PCA", "D. DBSCAN"],
      "answer": "B",
      "explanation": "决策树是典型的监督学习算法，依赖标注数据。"
    },
    {
      "source_id": "q2",
      "type": "multiple",
      "stem": "以下哪些是机器学习中的监督学习算法？（多选）",
      "options": ["A. K-Means", "B. 决策树", "C. PCA", "D. DBSCAN"],
      "answer": "BD"
    },
    {
      "source_id": "q3",
      "type": "judge",
      "stem": "@WebMvcTest 是 Spring 完整集成测试注解。",
      "options": ["A. 正确", "B. 错误"],
      "answer": "B"
    },
    {
      "source_id": "q4",
      "type": "fill",
      "stem": "Spring Boot 中用于 Controller 测试的注解是 ____。",
      "options": null,
      "answer": "@WebMvcTest"
    },
    {
      "source_id": "q5",
      "type": "short",
      "stem": "简述 TDD 的基本流程。",
      "options": null,
      "answer": "TDD 三步：红、绿、重构。"
    },
    {
      "source_id": "q6",
      "type": "code",
      "stem": "阅读以下代码，@WebMvcTest 注解的作用是？",
      "options": ["A. 数据层测试", "B. 控制层切片测试", "C. 集成测试", "D. 性能测试"],
      "codeBlock": "@WebMvcTest(UserController.class)\npublic class UserApiTest {}",
      "answer": "B"
    }
  ]
}

【必须遵守的规则】
1. 顶层是对象，含 questions 数组；questions 数组不能为空字符串或被截断。
2. 输入中若有 <!-- QUESTION_ID:qN -->，输出必须原样填写 source_id，并确保每个 ID 恰好对应一道题。
3. type 取值: choice(单项选择题) / multiple(多项选择题) / judge(判断题) / fill(填空题) / short(简答题) / code(代码分析题)。
4. 选择题 options 为数组，每项以 "A. ", "B. ", "C. ", "D. " 开头；answer 写选项字母（如 "A"）。
5. 多项选择题 answer 写全部正确选项字母并按字母排序（如 "ACD"）。
6. 判断题 options 固定为 ["A. 正确", "B. 错误"]，answer 写 A 或 B。
7. 填空题 stem 用 "___" 表示空缺，answer 为填入的原文。
8. 简答题 answer 为学习者会写的参考答案。
9. 跳过标题、目录、非题目的散文段落。
10. 保留原语言。
11. 没有题目则返回 {"questions":[]}（必须保证 json 闭合、数组完整）。
12. 永远不要返回 Markdown 代码块、注释、或 json 之外的任何字符。
13. 【题数预算】本次调用最多返回 12 道题。如果提示中要求更少，请以提示为准，但仍然需要保证每题完整。
14. 【完整度】每道题都必须完整：必须有 stem、answer、type；缺字段视为不完整，禁止返回不完整的题目。`;

export function buildUserPrompt(input: LLMInput): string {
  if (input.images && input.images.length) {
    return `从以下 ${input.images.length} 页图片中提取题目。${input.hint ? `主题：${input.hint}` : ''}`;
  }
  return `从以下学习材料中提取题目。${input.hint ? `主题：${input.hint}` : ''}\n\n${input.text ?? ''}`;
}

export function parseAndValidate(raw: string): ExtractedQuestion[] {
  const trimmed = raw.trim();
  const candidates: string[] = [];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(trimmed);

  // 策略 1：直接尝试严格的第一个 { 到最后一个 }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  // 策略 2：如果尾部被截断（流式响应常见），尝试闭合 questions 数组和对象
  if (firstBrace >= 0) {
    const partial = trimmed.slice(firstBrace);
    const repaired = repairTruncatedJson(partial);
    if (repaired !== partial) candidates.push(repaired);
  }

  const errors: string[] = [];
  for (const c of candidates) {
    let json: unknown;
    try {
      json = JSON.parse(c);
    } catch {
      try {
        json = JSON5.parse(c);
      } catch (e) {
        errors.push(`JSON.parse 失败: ${(e as Error).message}`);
        continue;
      }
    }
    const parsed = ExtractedQuestionListSchema.safeParse(json);
    if (parsed.success) {
      // zod 允许 answer=null，但 ExtractedQuestion 类型要求 answer 是非空字符串
      // 这里再过滤一次（防止 zod transform 后剩下空字符串的边界情况）
      return parsed.data.questions
        .filter((q) => q.answer != null && q.answer !== '' && q.stem != null && q.stem !== '')
        .map((q): ExtractedQuestion => {
          const normalizedOpts = isOptionQuestion(q.type) ? normalizeOptions(q.options) : q.options;
          const normalizedAnswer = isOptionQuestion(q.type)
            ? resolveAnswerByContent(
                normalizeChoiceAnswer(q.answer ?? '', normalizedOpts),
                normalizedOpts,
              )
            : q.answer ?? '';
          return {
            ...q,
            options: normalizedOpts,
            answer: normalizedAnswer,
            explanation: q.explanation ?? undefined,
            page_or_section: q.page_or_section ?? undefined,
          };
        });
    }
    // 策略 3：zod 失败但 JSON 本身合法——尝试提取 questions 数组中已完整对象
    const salvaged = salvageQuestions(json);
    if (salvaged.length > 0) return salvaged;
    errors.push(
      `zod 失败: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  const preview = trimmed.length > 600 ? trimmed.slice(0, 600) + '…' : trimmed;
  throw new Error(
    `LLM 输出无法解析为合法 JSON。\n候选解析错误：\n${errors.join('\n')}\n\n原始返回（前 600 字）：\n${preview}`,
  );
}

export async function askPracticeQuestion(
  input: PracticeAskRequest,
): Promise<string> {
  const settings = applyLLMProviderDefaults(getSettings().llm);
  const system = `${STUDY_CHAT_SYSTEM_PROMPT}\n\n${buildPracticeContext(input)}`;
  const history = (input.history ?? [])
    .filter(
      (m): m is StudyChatMessage =>
        m.role === 'user' || m.role === 'assistant',
    )
    .slice(-6);
  const messages = [
    ...history,
    { role: 'user' as const, content: input.prompt.trim() },
  ].filter((m): m is StudyChatMessage => Boolean(m.content.trim()));

  if (messages.length === 0) {
    throw new Error('提问内容不能为空');
  }

  switch (settings.provider) {
    case 'ollama':
      return chatWithOllama(settings, system, messages);
    case 'anthropic':
      return chatWithAnthropic(settings, system, messages);
    case 'openai':
    case 'deepseek':
    case 'gemini':
    case 'groq':
    case 'xai':
    case 'openrouter':
      return chatWithOpenAICompat(
        settings,
        system,
        messages,
      );
  }

  throw new Error(`不支持的模型提供商: ${(settings as { provider?: string }).provider ?? 'unknown'}`);
}

export async function gradePracticeAnswer(
  input: PracticeGradeRequest,
): Promise<PracticeGradeResult> {
  const fallback = localGradeAnswer(input.question, input.userAnswer);
  const settings = applyLLMProviderDefaults(getSettings().llm);
  const prompt = buildPracticeGradePrompt(input);

  try {
    let raw = '';
    switch (settings.provider) {
      case 'ollama':
        raw = await chatWithOllama(
          settings,
          PRACTICE_GRADE_SYSTEM_PROMPT,
          [{ role: 'user', content: prompt }],
        );
        break;
      case 'anthropic':
        raw = await chatWithAnthropic(
          settings,
          PRACTICE_GRADE_SYSTEM_PROMPT,
          [{ role: 'user', content: prompt }],
        );
        break;
      case 'openai':
      case 'deepseek':
      case 'gemini':
      case 'groq':
      case 'xai':
      case 'openrouter':
        raw = await chatWithOpenAICompat(
          settings,
          PRACTICE_GRADE_SYSTEM_PROMPT,
          [{ role: 'user', content: prompt }],
        );
        break;
      default:
        throw new Error(
          `不支持的模型提供商: ${(settings as { provider?: string }).provider ?? 'unknown'}`,
        );
    }

    const parsed = parsePracticeGradeResult(raw);
    return {
      isCorrect: parsed.isCorrect,
      reason: parsed.reason || fallback.reason,
      mode: 'ai',
    };
  } catch (error) {
    console.warn('[gradePracticeAnswer] AI 判分失败，已回退本地判分：', (error as Error).message);
    return {
      ...fallback,
      mode: 'fallback',
    };
  }
}

export async function testModelConnection(
  input: ModelTestRequest,
): Promise<ModelTestResult> {
  const settings = applyLLMProviderDefaults(input.llm);
  const startedAt = Date.now();
  const content = await chatWithConfiguredModel(
    settings,
    '你是 OpenStudy 的模型连通性测试助手。请只回复一句简短的话，确认模型已经可用。',
    [{ role: 'user', content: '请回复：连接成功。' }],
  );

  return {
    ok: true,
    provider: settings.provider,
    model: settings.model,
    latencyMs: Math.max(Date.now() - startedAt, 1),
    message: content.slice(0, 120).trim() || '连接成功',
  };
}

export async function generateStudyInsights(
  input: StudyInsightsRequest,
): Promise<StudyInsightsResult> {
  const settings = applyLLMProviderDefaults(getSettings().llm);
  if (!input.attempts.length) {
    return {
      summary:
        input.language === 'en'
          ? 'Not enough recent attempts yet.'
          : '最近还没有足够的做题记录。',
      highlights: [],
      risks: [],
      actions: [],
    };
  }

  const prompt = buildStudyInsightsPrompt(input);
  const raw = await chatWithConfiguredModel(
    settings,
    STUDY_INSIGHTS_SYSTEM_PROMPT,
    [{ role: 'user', content: prompt }],
  );

  return parseStudyInsightsResult(raw);
}

function buildPracticeContext(input: PracticeAskRequest): string {
  const optionText = input.question.options?.length
    ? input.question.options.join('\n')
    : null;
  const answerState =
    input.userAnswer && input.userAnswer.trim()
      ? [
          `学生答案：${input.userAnswer}`,
          input.isCorrect == null ? '' : `判分结果：${input.isCorrect ? '正确' : '错误'}`,
        ]
          .filter(Boolean)
          .join('\n')
      : '学生暂未作答';

  return [
    '以下是当前题目的上下文，请始终结合它来回答。',
    `题型：${input.question.type}`,
    `题干：${input.question.stem}`,
    optionText ? `选项：\n${optionText}` : '',
    `参考答案：${input.question.answer}`,
    input.question.explanation ? `题目解析：${input.question.explanation}` : '',
    answerState,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildPracticeGradePrompt(input: PracticeGradeRequest): string {
  const optionText = input.question.options?.length
    ? input.question.options.join('\n')
    : null;

  return [
    '请根据以下题目上下文进行判分：',
    `题型：${input.question.type}`,
    `题干：${input.question.stem}`,
    optionText ? `选项：\n${optionText}` : '',
    `参考答案：${input.question.answer}`,
    input.question.explanation ? `题目解析：${input.question.explanation}` : '',
    `学生答案：${input.userAnswer.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildStudyInsightsPrompt(input: StudyInsightsRequest): string {
  const attempts = input.attempts.slice(0, 80);
  const lang =
    input.language === 'en'
      ? 'Please reply in English.'
      : '请使用中文输出。';

  const attemptLines = attempts.map((item, index) => {
    const when = new Date(item.attempted_at).toISOString();
    return [
      `${index + 1}. 时间: ${when}`,
      `文档: ${item.document_title}`,
      `题型: ${item.question_type}`,
      `结果: ${item.is_correct ? '正确' : '错误'}`,
      `学生答案: ${item.user_answer || '(empty)'}`,
      `参考答案: ${item.reference_answer}`,
      `题干: ${item.question_stem.replace(/\s+/g, ' ').slice(0, 120)}`,
    ].join(' | ');
  });

  return [
    lang,
    `最近做题记录共 ${attempts.length} 条，请分析学习状态。`,
    '请特别关注：正确率变化、重复出错的题型、文档分布、最近状态波动、下一步练习建议。',
    '记录如下：',
    attemptLines.join('\n'),
  ].join('\n\n');
}

function parseStudyInsightsResult(raw: string): StudyInsightsResult {
  const trimmed = raw.trim();
  const candidates: string[] = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.unshift(fenced[1].trim());

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    let json: unknown;
    try {
      json = JSON.parse(candidate);
    } catch {
      try {
        json = JSON5.parse(candidate);
      } catch {
        continue;
      }
    }
    const parsed = StudyInsightsResultSchema.safeParse(json);
    if (parsed.success) return parsed.data;
  }

  throw new Error(`学习洞察结果无法解析：${trimmed.slice(0, 300)}`);
}

function parsePracticeGradeResult(raw: string): z.infer<typeof PracticeGradeResultSchema> {
  const trimmed = raw.trim();
  const candidates: string[] = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.unshift(fenced[1].trim());

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    let json: unknown;
    try {
      json = JSON.parse(candidate);
    } catch {
      try {
        json = JSON5.parse(candidate);
      } catch {
        continue;
      }
    }
    const parsed = PracticeGradeResultSchema.safeParse(json);
    if (parsed.success) return parsed.data;
  }

  throw new Error(`AI 判分结果无法解析：${trimmed.slice(0, 300)}`);
}

async function chatWithOpenAICompat(
  cfg: {
    baseUrl?: string;
    apiKey?: string;
    model: string;
  },
  system: string,
  messages: StudyChatMessage[],
): Promise<string> {
  const baseUrl = (cfg.baseUrl ?? '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('当前模型未配置 baseUrl');
  if (!cfg.apiKey) throw new Error('当前模型未配置 API Key');
  if (!cfg.model) throw new Error('当前模型未配置 model');

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI 提问失败: ${resp.status} ${text}`);
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('AI 没有返回有效内容');
  return content;
}

async function chatWithConfiguredModel(
  settings: ReturnType<typeof applyLLMProviderDefaults>,
  system: string,
  messages: StudyChatMessage[],
): Promise<string> {
  switch (settings.provider) {
    case 'ollama':
      return chatWithOllama(settings, system, messages);
    case 'anthropic':
      return chatWithAnthropic(settings, system, messages);
    case 'openai':
    case 'deepseek':
    case 'gemini':
    case 'groq':
    case 'xai':
    case 'openrouter':
      return chatWithOpenAICompat(settings, system, messages);
  }

  throw new Error(
    `不支持的模型提供商: ${(settings as { provider?: string }).provider ?? 'unknown'}`,
  );
}

async function chatWithOllama(
  cfg: {
    baseUrl?: string;
    model: string;
  },
  system: string,
  messages: StudyChatMessage[],
): Promise<string> {
  const baseUrl = (cfg.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
  if (!cfg.model) throw new Error('当前模型未配置 model');

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI 提问失败: ${resp.status} ${text}`);
  }
  const data = (await resp.json()) as { message?: { content?: string } };
  const content = data.message?.content?.trim();
  if (!content) throw new Error('AI 没有返回有效内容');
  return content;
}

async function chatWithAnthropic(
  cfg: {
    baseUrl?: string;
    apiKey?: string;
    model: string;
  },
  system: string,
  messages: StudyChatMessage[],
): Promise<string> {
  const baseUrl = (cfg.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
  if (!cfg.apiKey) throw new Error('当前模型未配置 API Key');
  if (!cfg.model) throw new Error('当前模型未配置 model');

  const resp = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2048,
      system,
      messages: messages.map((m) => ({
        role: m.role,
        content: [{ type: 'text', text: m.content }],
      })),
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI 提问失败: ${resp.status} ${text}`);
  }
  const data = (await resp.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const content = (data.content ?? [])
    .map((block) => (block.type === 'text' ? block.text ?? '' : ''))
    .join('')
    .trim();
  if (!content) throw new Error('AI 没有返回有效内容');
  return content;
}

// 修复被截断的 JSON：在末尾补全 ]}
// 用于流式响应或 token 上限导致的截断
function repairTruncatedJson(s: string): string {
  let out = s;
  // 去掉尾部不完整的 "options":[...] 中可能缺的闭合
  // 简化处理：按括号配对补全
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  // 截断的字符串末尾补一个 "
  if (inString) out += '"';
  while (stack.length) out += stack.pop();
  return out;
}

// 当顶层 { questions: [...] } 解析成功但某些元素 zod 失败时，
// 提取那些完整合法的 question 对象作为兜底（丢弃 stem/answer 缺失的不完整题）
function salvageQuestions(json: unknown): ExtractedQuestion[] {
  if (
    typeof json !== 'object' ||
    json === null ||
    !Array.isArray((json as { questions?: unknown }).questions)
  ) {
    return [];
  }
  const arr = (json as { questions: unknown[] }).questions;
  const ok: ExtractedQuestion[] = [];
  for (const item of arr) {
    // 必须是对象
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    const type = obj.type;
    const stem = obj.stem;
    const answer = obj.answer;
    // 过滤不完整的题（被 max_tokens 截断常见症状）
    if (typeof stem !== 'string' || !stem.trim()) continue;
    if (typeof answer !== 'string' || !answer.trim()) continue;
    if (typeof type !== 'string' || !type.trim()) continue;
    ok.push({
      type: normalizeType(type),
      stem: stem.trim(),
      options: normalizeOptions(obj.options as string[] | string | null | undefined),
      answer:
        normalizeType(type) === 'choice'
          ? normalizeChoiceAnswer(
              answer.trim(),
              normalizeOptions(obj.options as string[] | string | null | undefined),
            )
          : answer.trim(),
      explanation: typeof obj.explanation === 'string' ? obj.explanation : undefined,
      page_or_section:
        typeof obj.page_or_section === 'string' ? obj.page_or_section : undefined,
    });
  }
  return ok;
}

let _provider: LLMProvider | null = null;
let _providerKey = '';

export function getLLMProvider(): LLMProvider {
  const settings = applyLLMProviderDefaults(getSettings().llm);
  const key = `${settings.provider}|${settings.baseUrl ?? ''}|${settings.model}|${settings.apiKey ?? ''}`;
  if (_provider && _providerKey === key) return _provider;
  _providerKey = key;
  switch (settings.provider) {
    case 'ollama':
      _provider = new OllamaProvider(settings);
      break;
    case 'openai':
      _provider = new OpenAIProvider(settings);
      break;
    case 'deepseek':
      _provider = new DeepSeekProvider(settings);
      break;
    case 'anthropic':
      _provider = new AnthropicProvider(settings);
      break;
    case 'gemini':
    case 'groq':
    case 'xai':
    case 'openrouter':
      _provider = new OpenAICompatProvider(settings);
      break;
  }
  return _provider!;
}
