/**
 * 标准练习题 Markdown 解析器
 *
 * 接受的格式(兼容 LLM 输出的近似格式)：
 *
 *   # 文档标题
 *   > 可选描述
 *   ---
 *
 *   ### 1. 题干内容...
 *   - A. 选项
 *   - B. 选项
 *   Type: choice
 *   **<答案>** A
 *   **<解析>** 解释...
 *   **<难度>** ★★☆
 *   **<考点>** xxx
 *   **<标签>** #a #b
 *   ---
 *
 *   ### 2. 判断题...
 *   - [ ] 正确
 *   - [ ] 错误
 *   Type: judge
 *   **<答案>** 错误
 *   ---
 *
 *   ### 3. 填空题...
 *   题干用 ______ 表示空缺
 *   Type: fill
 *   **<答案>** 答案内容
 *   ---
 *
 *   ### 4. 简答题...
 *   Type: short
 *   **<答案>** 自由文本答案
 *   ---
 *
 *   ### 5. 代码题(单选)...
 *   ```java
 *   // 代码
 *   ```
 *   - A. 选项
 *   Type: code
 *   **<答案>** A
 *   ---
 *
 *   ### 6. 复合题...
 *   **<问题 1>** ...
 *   **<问题 2>** ...
 *
 * 解析结果：
 *   - 如存在 ## 题型标题，则保留为 Section；否则自动归入隐式分组
 *   - 1 道小题 = 1 个 ParsedQuestion
 *   - 解析失败时记录到 issues，不影响其他题
 */

import type { QuestionType } from './types.js';
import {
  detectMarkdownStandardLanguage,
  inferQuestionTypeFromHeading,
  normalizeQuestionTypeValue,
  normalizeSectionHeading,
} from './markdown-standard.js';

export interface ParsedOption {
  /** 字母 A/B/C/D/... */
  letter: string;
  /** 选项内容(去掉了前缀 "A. ") */
  text: string;
}

export interface ParsedQuestion {
  /** 在大题内的顺序(从 1 开始) */
  number: number;
  /** 题干(去掉了题号 "1. ") */
  stem: string;
  /** 选项(选择/判断/代码题)，可能包含代码块 */
  type: QuestionType;
  /** 选择题选项(判断题用 [true, false] 表示 "正确/错误") */
  options: ParsedOption[] | null;
  /** 原始答案字符串("A"、"错误"、"具体内容") */
  answer: string;
  /** 是否多选 */
  multiple: boolean;
  /** 题干中的代码块(保留原始 markdown 格式) */
  codeBlock: string | null;
  /** 解析后的解析文本 */
  explanation: string | null;
  /** 难度等级 ★~★★★ */
  difficulty: string | null;
  /** 考点 */
  topic: string | null;
  /** 标签 */
  tags: string[];
  /** 复合题的子问题 */
  subQuestions: ParsedQuestion[];
}

export interface ParsedSection {
  /** 大题标题("一、单选题") */
  title: string;
  /** 大题标识("一"、"二") */
  number: string;
  /** 大题内可选的说明 */
  instruction: string;
  /** 大题下的小题 */
  questions: ParsedQuestion[];
}

export interface ParsedExam {
  /** 文档标题("# 标题") */
  title: string;
  /** 可选描述("> xxx") */
  description: string;
  /** 各道大题 */
  sections: ParsedSection[];
  /** 解析过程中的问题(行号、消息、级别) */
  issues: ParseIssue[];
}

export interface ParseIssue {
  level: 'warning' | 'error';
  message: string;
  line?: number;
}

// 题目大题标题：兼容 "## 一、单选题" / "## 单选题" / "## Multiple Choice"
const SECTION_HEADER_RE = /^##\s+(.+)$/;
// 小题标题：匹配 "### 1." "### 1、" "### (1)" 等
const QUESTION_HEADER_RE = /^###\s+[\((]?(\d+)[\))、.\s]+(.*)$/;
// 答案块
const ANSWER_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:参考答案|正确答案|标准答案|答案|answer)\s*[\u3011\]>]?\*\*|(?:参考答案|正确答案|标准答案|答案|answer))\s*[:：]?\s*(.*)$/i;
// 解析块
const EXPLANATION_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:答案解析|解析|解题思路|思路|explanation)\s*[\u3011\]>]?\*\*|(?:答案解析|解析|解题思路|思路|explanation))\s*[:：]?\s*(.*)$/i;
const TYPE_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:题型|类型|question\s*type|type)\s*[\u3011\]>]?\*\*|(?:题型|类型|question\s*type|type))\s*[:：]?\s*(.*)$/i;
// 难度块
const DIFFICULTY_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:难度|difficulty)\s*[\u3011\]>]?\*\*|(?:难度|difficulty))\s*[:：]?\s*(.+)$/i;
// 考点块
const TOPIC_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:考点|知识点|topic)\s*[\u3011\]>]?\*\*|(?:考点|知识点|topic))\s*[:：]?\s*(.+)$/i;
// 标签块
const TAGS_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:标签|tags?)\s*[\u3011\]>]?\*\*|(?:标签|tags?))\s*[:：]?\s*(.+)$/i;
// 选项行："- A. xxx" 或 "- A、xxx" 或 "- A xxx"
const OPTION_RE = /^\s*[-*+]\s*([A-Za-z])[、）).\]]\s*(.+)$/;
// 判断题选项："- [ ] 正确" 或 "- [x] 错误"
const JUDGE_OPTION_RE = /^\s*[-*+]\s*\[[ xX]\]\s*(.+)$/;
// 填空空缺：______
const FILL_BLANK_RE = /_{2,}/g;
// 复合题子题：**【问题 N】**
const SUBQ_RE = /^\*\*[\u3010\[]问题\s*(\d+)[\u3011\]]\*\*\s*[:：]?\s*(.*)$/;
// 横向分隔线
const DIVIDER_RE = /^---\s*$/;
const SECTION_NUMBER_RE =
  /^(?:\d+\s+)?(?:第?\s*([一二三四五六七八九十百千万0-9]+)\s*[、.．:：)）]\s*|([一二三四五六七八九十百千万0-9]+)\s*[、.．:：)）]\s*)/;

export class ExamParseError extends Error {
  constructor(
    public readonly issues: ParseIssue[],
    message?: string,
  ) {
    super(message || `文档解析失败，存在 ${issues.length} 个问题`);
    this.name = 'ExamParseError';
  }
}

function pushIssue(
  issues: ParseIssue[],
  level: 'warning' | 'error',
  message: string,
  line?: number,
) {
  issues.push({ level, message, line });
}

function detectTypeByOptions(options: ParsedOption[]): QuestionType {
  // 判断题：选项是 正确/错误
  if (options.length === 2) {
    const texts = options.map((o) => o.text.trim());
    const isJudge =
      (texts.includes('正确') && texts.includes('错误')) ||
      (texts.includes('对') && texts.includes('错')) ||
      (texts.includes('T') && texts.includes('F')) ||
      (texts.includes('True') && texts.includes('False'));
    if (isJudge) return 'judge';
  }
  return 'choice';
}

function detectMultiple(answer: string, optionsCount: number): boolean {
  if (optionsCount < 2) return false;
  // 多选答案：包含 2+ 个字母，用逗号/空格/顿号/分号分隔
  const letters = answer
    .replace(/[，。；,;\s、]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((s) => /^[A-Za-z]$/.test(s));
  return letters.length >= 2;
}

function cleanStem(stem: string, codeBlock: string | null): string {
  let s = stem;
  if (codeBlock) {
    s = s.replace(/```[\s\S]*?```/g, '').trim();
  }
  return s;
}

function isSectionHeader(line: string): boolean {
  const match = SECTION_HEADER_RE.exec(line);
  return Boolean(match?.[1] && inferQuestionTypeFromHeading(match[1]));
}

function extractSectionNumber(line: string): string | null {
  const heading = line.replace(/^##\s+/, '').trim();
  const match = heading.match(SECTION_NUMBER_RE);
  return (match?.[1] ?? match?.[2] ?? null)?.trim() ?? null;
}

function parseOneQuestion(
  raw: string,
  number: number,
  startLine: number,
  issues: ParseIssue[],
): ParsedQuestion {
  const lines = raw.split('\n');
  const first = lines[0] ?? '';
  const stemLine = first.replace(/^###\s+[\((]?\d+[\))、.\s]+/, '').trim();

  // 收集 stem(包含代码块)
  const stemLines: string[] = [];
  let i = 1;
  let codeBlock: string | null = null;
  let inCode = false;
  let codeBuf: string[] = [];
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (inCode) {
      codeBuf.push(line);
      if (/^```/.test(line)) {
        inCode = false;
        codeBlock = codeBuf.join('\n');
        codeBuf = [];
      }
      i++;
      continue;
    }
    if (/^```/.test(line)) {
      inCode = true;
      codeBuf.push(line);
      i++;
      continue;
    }
    if (
      TYPE_RE.test(line) ||
      ANSWER_RE.test(line) ||
      EXPLANATION_RE.test(line) ||
      DIFFICULTY_RE.test(line) ||
      TOPIC_RE.test(line) ||
      TAGS_RE.test(line) ||
      SUBQ_RE.test(line) ||
      DIVIDER_RE.test(line) ||
      OPTION_RE.test(line) ||
      JUDGE_OPTION_RE.test(line)
    ) {
      break;
    }
    stemLines.push(line);
    i++;
  }

  // 提取选项 / 答案 / 解析 / 难度 / 考点 / 标签
  const options: ParsedOption[] = [];
  let answer = '';
  let explanation: string | null = null;
  let explicitType: QuestionType | null = null;
  let difficulty: string | null = null;
  let topic: string | null = null;
  let tags: string[] = [];
  const subQuestions: ParsedQuestion[] = [];
  let pendingSubNumber: number | null = null;
  let pendingSubStem = '';

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (DIVIDER_RE.test(line)) {
      i++;
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = TYPE_RE.exec(line))) {
      explicitType = normalizeQuestionTypeValue((m[1] ?? '').trim());
    } else if ((m = OPTION_RE.exec(line))) {
      options.push({ letter: (m[1] ?? '').toUpperCase(), text: (m[2] ?? '').trim() });
    } else if ((m = JUDGE_OPTION_RE.exec(line))) {
      options.push({ letter: 'A', text: (m[1] ?? '').trim() });
    } else if ((m = ANSWER_RE.exec(line))) {
      let j = i + 1;
      const buf: string[] = [(m[1] ?? '').trim()].filter(Boolean);
      while (j < lines.length) {
        const nl = lines[j] ?? '';
        if (
          TYPE_RE.test(nl) ||
          ANSWER_RE.test(nl) ||
          EXPLANATION_RE.test(nl) ||
          DIFFICULTY_RE.test(nl) ||
          TOPIC_RE.test(nl) ||
          TAGS_RE.test(nl) ||
          DIVIDER_RE.test(nl) ||
          SUBQ_RE.test(nl) ||
          OPTION_RE.test(nl) ||
          JUDGE_OPTION_RE.test(nl)
        ) {
          break;
        }
        if (nl.trim()) buf.push(nl.trim());
        j++;
      }
      answer = buf.join('\n').trim();
      i = j;
      continue;
    } else if ((m = EXPLANATION_RE.exec(line))) {
      // 解析可能跨多行，一直收集直到遇到下一个特殊标记
      let j = i + 1;
      const buf: string[] = [(m[1] ?? '').trim()];
      while (j < lines.length) {
        const nl = lines[j] ?? '';
        if (
          TYPE_RE.test(nl) ||
          ANSWER_RE.test(nl) ||
          EXPLANATION_RE.test(nl) ||
          DIFFICULTY_RE.test(nl) ||
          TOPIC_RE.test(nl) ||
          TAGS_RE.test(nl) ||
          DIVIDER_RE.test(nl) ||
          SUBQ_RE.test(nl) ||
          OPTION_RE.test(nl) ||
          JUDGE_OPTION_RE.test(nl)
        ) {
          break;
        }
        buf.push(nl);
        j++;
      }
      explanation = buf.join('\n').trim();
      i = j;
      continue;
    } else if ((m = DIFFICULTY_RE.exec(line))) {
      difficulty = (m[1] ?? '').trim();
    } else if ((m = TOPIC_RE.exec(line))) {
      topic = (m[1] ?? '').trim();
    } else if ((m = TAGS_RE.exec(line))) {
      tags = (m[1] ?? '')
        .split(/[\s,，]+/)
        .map((s) => s.replace(/^#/, '').trim())
        .filter(Boolean);
    } else if ((m = SUBQ_RE.exec(line))) {
      // 复合题子题：累计 subQuestions
      const subNum = Number(m[1] ?? 0);
      const subRest = (m[2] ?? '').trim();
      subQuestions.push({
        number: subNum,
        stem: subRest,
        type: 'short', // 默认简答
        options: null,
        answer: '',
        multiple: false,
        codeBlock: null,
        explanation: null,
        difficulty: null,
        topic: null,
        tags: [],
        subQuestions: [],
      });
      pendingSubNumber = subNum;
      pendingSubStem = subRest;
    } else if (pendingSubNumber !== null && line.trim()) {
      // 收集子题题干后续行
      const last = subQuestions[subQuestions.length - 1];
      if (last) last.stem += '\n' + line.trim();
    }
    i++;
  }

  const stem = stemLines.join('\n').trim();
  // 类型推断：有选项 → 根据选项判断（选择/判断）；无选项 → 根据代码块判断（代码题）；否则 → 填空（题干含 ____）→ 简答
  let type: QuestionType;
  // 代码题：有代码块时优先 type=code
  if (explicitType) {
    type = explicitType;
  } else if (codeBlock) {
    type = 'code';
  } else if (options.length > 0) {
    type = detectTypeByOptions(options);
  } else if (FILL_BLANK_RE.test(stem.trim())) {
    type = 'fill';
  } else {
    type = 'short';
  }
  const multiple =
    type === 'multiple'
      ? true
      : (type === 'choice' || type === 'code')
        ? detectMultiple(answer, options.length)
        : false;
  const cleanStemText = cleanStem(stem, codeBlock);

  // 校验
  if (!answer) {
    pushIssue(issues, 'warning', `第 ${number} 题缺少答案`, startLine);
  }
  if ((type === 'choice' || type === 'multiple' || type === 'code') && options.length < 2) {
    pushIssue(issues, 'warning', `第 ${number} 题选项少于 2 个`, startLine);
  }
  if (type === 'judge') {
    // 标准化为 true/false
    if (answer === '正确' || /^[Tt]rue$|^对$/.test(answer)) answer = 'true';
    else if (answer === '错误' || /^[Ff]alse$|^错$/.test(answer)) answer = 'false';
  }

  return {
    number,
    stem: cleanStemText,
    type: multiple && type === 'choice' ? 'multiple' : type,
    options: type === 'judge' ? null : options.length ? options : null,
    answer,
    multiple,
    codeBlock,
    explanation,
    difficulty,
    topic,
    tags,
    subQuestions,
  };
}

export function parseExamMarkdown(md: string): ParsedExam {
  const issues: ParseIssue[] = [];
  const text = md.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const language = detectMarkdownStandardLanguage(md);

  // 1. 解析标题和描述
  let title = '';
  let description = '';
  let i = 0;
  if (/^#\s+/.test(lines[0] ?? '')) {
    title = (lines[0] ?? '').replace(/^#\s+/, '').trim();
    i = 1;
  }
  // 收集块引用作为描述
  const descBuf: string[] = [];
  while (i < lines.length) {
    const l = lines[i] ?? '';
    if (/^#/.test(l) || isSectionHeader(l) || QUESTION_HEADER_RE.test(l)) break;
    if (/^>\s+/.test(l)) descBuf.push(l.replace(/^>\s+/, '').trim());
    i++;
  }
  description = descBuf.join('\n').trim();

  // 2. 切大题
  const sections: ParsedSection[] = [];
  let curSec: ParsedSection | null = null;
  let curSecStart = 0;
  let curQ: { raw: string[]; num: number; startLine: number } | null = null;
  const flushQuestion = () => {
    if (curQ && curSec) {
      const raw = curQ.raw.join('\n');
      sections[sections.length - 1]?.questions.push(
        parseOneQuestion(raw, curQ.num, curQ.startLine, issues),
      );
    }
    curQ = null;
  };
  const flushSection = () => {
    flushQuestion();
    curSec = null;
  };
  const ensureImplicitSection = () => {
    if (curSec) return;
    sections.push({
      number: String(sections.length + 1),
      title: language === 'en' ? 'Mixed Questions' : '未分组题目',
      instruction: '',
      questions: [],
    });
    curSec = sections[sections.length - 1]!;
    curSecStart = i;
  };

  while (i < lines.length) {
    const line = lines[i] ?? '';
    let m: RegExpExecArray | null;

    if ((m = SECTION_HEADER_RE.exec(line))) {
      const rawHeading = (m[1] ?? '').trim();
      if (!inferQuestionTypeFromHeading(rawHeading)) {
        i++;
        continue;
      }
      flushSection();
      const secNum = extractSectionNumber(line) ?? String(sections.length + 1);
      const secTitle = normalizeSectionHeading(rawHeading, language);
      // 收集说明
      let j = i + 1;
      const insBuf: string[] = [];
      while (j < lines.length) {
        const l = lines[j] ?? '';
        if (
          isSectionHeader(l) ||
          QUESTION_HEADER_RE.test(l) ||
          /^#/.test(l)
        ) {
          break;
        }
        if (/^>\s+/.test(l)) insBuf.push(l.replace(/^>\s+/, '').trim());
        j++;
      }
      sections.push({
        number: secNum,
        title: secTitle,
        instruction: insBuf.join('\n').trim(),
        questions: [],
      });
      curSec = sections[sections.length - 1]!;
      curSecStart = i;
      i = j;
      continue;
    }

    if ((m = QUESTION_HEADER_RE.exec(line))) {
      ensureImplicitSection();
      flushQuestion();
      curQ = { raw: [line], num: Number(m[1] ?? 0), startLine: i + 1 };
      i++;
      continue;
    }

    if (curQ) {
      curQ.raw.push(line);
    }
    i++;
  }
  flushSection();

  if (sections.length === 0) {
    pushIssue(issues, 'error', '未发现任何可解析题目，建议检查是否存在 ### 题号、Type、Answer 等关键字段。');
  }
  for (const sec of sections) {
    if (sec.questions.length === 0) {
      pushIssue(issues, 'warning', `大题"${sec.title}"内没有小题`);
    }
  }

  return { title, description, sections, issues };
}

/** 提取 Markdown 中所有填空空缺(题干中的"____") */
export function extractFillBlanks(stem: string): number {
  return (stem.match(/_{2,}/g) || []).length;
}
