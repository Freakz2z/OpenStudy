import type { ExtractedQuestion, Question, QuestionType } from './types.js';
import { inferQuestionTypeFromHeading } from './markdown-standard.js';

export type QuestionIssueSeverity = 'info' | 'warning';

export interface QuestionIssue {
  code: string;
  severity: QuestionIssueSeverity;
  message: string;
  line?: number;
}

export interface MarkdownPrecheckReport {
  estimatedQuestionCount: number;
  optionLineCount: number;
  answerLineCount: number;
  explanationLineCount: number;
  issueCount: number;
  issues: QuestionIssue[];
}

export interface IdentifyQualityReport {
  estimatedQuestionCount: number;
  identifiedQuestionCount: number;
  coverageRatio: number | null;
  typeCounts: Record<QuestionType, number>;
  missingExplanationCount: number;
  duplicateStemCount: number;
  suspiciousQuestionCount: number;
  issueCount: number;
  issues: QuestionIssue[];
}

export interface IdentifyQuestionsResult {
  questions: Question[];
  diagnostics: IdentifyQualityReport;
}

const QUESTION_LINE_RE =
  /^\s*(?:#{1,6}\s*)?(?:[-*+]\s*)?(第\s*[一二三四五六七八九十百千万0-9]+\s*题|[（(]?\s*\d{1,4}\s*[.、．:：)）]|[一二三四五六七八九十百千万]+[、．)）])\s*/;
const SECTION_HEADING_RE =
  /^\s*(?:#{1,6}\s*)?(?:\d+\s+)?(?:第?\s*[一二三四五六七八九十百千万0-9]+\s*[、.．:：)）]\s*)?(?:代码\s*(?:题|解析|分析)(?:\s*[（(]?\s*(?:单选|选择)\s*[）)]?)?|单选题|单项选择题|多选题|多项选择题|选择题|判断题|是非题|填空题|简答题|问答题|论述题|code\s*(?:analysis|question)|single\s+choice|multiple\s+choice|multiple\s+select|true\s*\/\s*false|true\s+or\s+false|fill\s+in\s+the\s+blank|fill\s+in\s+the\s+blanks|short\s+answer|essay)\s*(?:[（(]\s*共?\s*\d+\s*题\s*[）)])?\s*(?:(?:[.．·…]{2,}\s*)?\d+)?\s*$/i;
const OPTION_LINE_RE = /^\s*(?:[-*+]\s*)?[（(]?\s*[A-Za-z]\s*[.、．:：)\]】）]\s*\S+/;
const ANSWER_LINE_RE =
  /^(?:\s*(?:[-*+]\s*)?(?:\*\*[\u3010\[<]?\s*(?:答案|参考答案|正确答案|标准答案|answer)\s*[\u3011\]>]?\*\*|[【\[]\s*(?:答案|参考答案|正确答案|标准答案|answer)\s*[:：]?\s*.*?[】\]]|(?:答案|参考答案|正确答案|标准答案|answer))\s*[:：]?\s*.*)$/i;
const JUDGE_ANSWER_LINE_RE = /^\s*[【\[]\s*(?:对|错|正确|错误|是|否|√|×|true|false)\s*[】\]]/i;
const SHORT_ANSWER_MARKER_RE = /(?:参考|答题要点|答案要点|框架回顾)\s*[:：]?\s*$/;
const EXPLANATION_LINE_RE =
  /^(?:\s*(?:[-*+]\s*)?(?:\*\*[\u3010\[<]?\s*(?:解析|答案解析|说明|思路|explanation)\s*[\u3011\]>]?\*\*|[【\[]\s*(?:解析|答案解析|说明|思路|explanation)\s*[:：]?\s*.*?[】\]]|(?:解析|答案解析|说明|思路|explanation))\s*[:：]?\s*.*)$/i;
const APPENDIX_ANSWER_RE = /(?:附录\s*[:：]?)?\s*答案速查表/;
const DIVIDER_RE = /^---\s*$/;

type Block = {
  line: number;
  title: string;
  optionCount: number;
  answerCount: number;
  explanationCount: number;
};

export function analyzeMarkdownPrecheck(markdown: string): MarkdownPrecheckReport {
  const lines = markdown.split(/\r?\n/);
  const issues: QuestionIssue[] = [];
  const blocks: Block[] = [];
  let optionLineCount = 0;
  let answerLineCount = 0;
  let explanationLineCount = 0;
  let current: Block | null = null;
  let ignoreRemainder = false;

  function pushCurrent() {
    if (!current) return;
    if (current.optionCount > 0 && current.optionCount < 2) {
      issues.push({
        code: 'option_count_low',
        severity: 'warning',
        line: current.line,
        message: `第 ${current.line} 行附近的题目疑似只有 ${current.optionCount} 个选项。`,
      });
    }
    if (current.answerCount === 0) {
      issues.push({
        code: 'missing_answer',
        severity: 'warning',
        line: current.line,
        message: `第 ${current.line} 行附近的题目未发现答案标记，可能影响识题。`,
      });
    }
    if (current.answerCount > 1) {
      issues.push({
        code: 'multiple_answer_lines',
        severity: 'info',
        line: current.line,
        message: `第 ${current.line} 行附近的题目出现多个答案标记，建议人工确认。`,
      });
    }
    blocks.push(current);
    current = null;
  }

  lines.forEach((line, index) => {
    if (ignoreRemainder) return;
    const trimmed = line.trim();
    if (!trimmed) return;
    const lineNo = index + 1;

    if (APPENDIX_ANSWER_RE.test(trimmed) && blocks.length > 0) {
      pushCurrent();
      ignoreRemainder = true;
      return;
    }

    if (DIVIDER_RE.test(trimmed)) {
      return;
    }

    if (
      SECTION_HEADING_RE.test(trimmed) ||
      (/^##\s+/.test(trimmed) && inferQuestionTypeFromHeading(trimmed.replace(/^##\s+/, ''))) ||
      /^\[\[(?:PDF\s+)?PAGE\s+\d+\]\]$/i.test(trimmed)
    ) {
      pushCurrent();
      return;
    }

    if (QUESTION_LINE_RE.test(trimmed)) {
      pushCurrent();
      current = {
        line: lineNo,
        title: trimmed,
        optionCount: 0,
        answerCount: 0,
        explanationCount: 0,
      };
      return;
    }

    if (OPTION_LINE_RE.test(trimmed)) {
      optionLineCount++;
      if (current) current.optionCount++;
      else {
        issues.push({
          code: 'orphan_option',
          severity: 'info',
          line: lineNo,
          message: `第 ${lineNo} 行出现孤立选项，前面没有明确题号。`,
        });
      }
      return;
    }

    if (ANSWER_LINE_RE.test(trimmed) || JUDGE_ANSWER_LINE_RE.test(trimmed) || SHORT_ANSWER_MARKER_RE.test(trimmed)) {
      answerLineCount++;
      if (current) current.answerCount++;
      else {
        issues.push({
          code: 'orphan_answer',
          severity: 'warning',
          line: lineNo,
          message: `第 ${lineNo} 行出现答案标记，但前面没有明确题号。`,
        });
      }
      return;
    }

    if (EXPLANATION_LINE_RE.test(trimmed)) {
      explanationLineCount++;
      if (current) current.explanationCount++;
    }
  });

  pushCurrent();

  if (blocks.length === 0 && markdown.trim()) {
    issues.push({
      code: 'no_question_marker',
      severity: 'warning',
      message: '没有发现明显题号或题目分隔标记，建议先整理 Markdown 结构。',
    });
  }

  return {
    estimatedQuestionCount: blocks.length,
    optionLineCount,
    answerLineCount,
    explanationLineCount,
    issueCount: issues.length,
    issues,
  };
}

export function buildIdentifyQualityReport(
  markdown: string,
  questions: Array<ExtractedQuestion | Question>,
): IdentifyQualityReport {
  const precheck = analyzeMarkdownPrecheck(markdown);
  const issues: QuestionIssue[] = [];
  const typeCounts: Record<QuestionType, number> = {
    choice: 0,
    multiple: 0,
    judge: 0,
    fill: 0,
    short: 0,
    code: 0,
  };

  const seen = new Map<string, number>();
  let duplicateStemCount = 0;
  let missingExplanationCount = 0;
  let suspiciousQuestionCount = 0;

  for (const q of questions) {
    typeCounts[q.type]++;
    const key = q.stem.replace(/\s+/g, ' ').trim().slice(0, 80);
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (!q.explanation?.trim()) missingExplanationCount++;

    if (q.stem.trim().length < 6) suspiciousQuestionCount++;
    if ((q.type === 'choice' || q.type === 'multiple' || q.type === 'judge') && (!q.options || q.options.length < 2)) {
      suspiciousQuestionCount++;
    }
  }

  duplicateStemCount = [...seen.values()].filter((count) => count > 1).length;

  const estimated = precheck.estimatedQuestionCount;
  const identified = questions.length;
  const coverageRatio = estimated > 0 ? identified / estimated : null;

  if (identified === 0) {
    issues.push({
      code: 'identified_none',
      severity: 'warning',
      message: '本次没有识别出题目，建议先检查 Markdown 结构或原文质量。',
    });
  }

  if (estimated > 0 && identified + 1 < estimated) {
    issues.push({
      code: 'possible_missing_questions',
      severity: 'warning',
      message: `预检估计约 ${estimated} 道题，但本次仅识别出 ${identified} 道，疑似存在漏题。`,
    });
  } else if (coverageRatio != null && coverageRatio < 1) {
    issues.push({
      code: 'coverage_partial',
      severity: 'info',
      message: `预检估计约 ${estimated} 道题，本次识别出 ${identified} 道，建议抽查边界题目。`,
    });
  }

  if (duplicateStemCount > 0) {
    issues.push({
      code: 'duplicate_stems',
      severity: 'warning',
      message: `识别结果中存在 ${duplicateStemCount} 组疑似重复题目。`,
    });
  }

  if (suspiciousQuestionCount > 0) {
    issues.push({
      code: 'suspicious_questions',
      severity: 'warning',
      message: `有 ${suspiciousQuestionCount} 道题目结构可疑，建议人工抽查。`,
    });
  }

  if (missingExplanationCount > 0) {
    issues.push({
      code: 'missing_explanations',
      severity: 'info',
      message: `有 ${missingExplanationCount} 道题没有解析。`,
    });
  }

  return {
    estimatedQuestionCount: estimated,
    identifiedQuestionCount: identified,
    coverageRatio,
    typeCounts,
    missingExplanationCount,
    duplicateStemCount,
    suspiciousQuestionCount,
    issueCount: issues.length,
    issues,
  };
}
