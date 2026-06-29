import type {
  Document,
  ExtractedQuestion,
  IdentifyAuditEvent,
} from '../../shared/types.js';
import {
  isOptionQuestion,
  normalizeChoiceAnswer,
  normalizeChoiceOptions,
} from '../../shared/question-format.js';
import type { MarkdownStandardLanguage } from '../../shared/markdown-standard.js';
import { parseFile } from './parser/index.js';
import { getLLMProvider } from './llm/index.js';
import { splitText } from './chunker.js';
import { textToMarkdown } from './parser/markdown.js';
import { normalizeStandardMarkdown } from '../../shared/markdown-standard.js';
import {
  segmentQuestionDocument,
  type SourceQuestionBlock,
} from './question-structure.js';

export interface IdentifyProgress {
  phase: 'parse' | 'llm' | 'merge' | 'done';
  message: string;
  current?: number;
  total?: number;
}

export interface IdentifyOptions {
  chunkThreshold?: number;
  chunkSize?: number;
  concurrency?: number;
  standardLang?: MarkdownStandardLanguage;
  onProgress?: (p: IdentifyProgress) => void;
  onAudit?: (event: IdentifyAuditEvent) => void;
}

// 非标准选项前缀（如 R/C/T/L）与出现顺序的映射。
type OptionLetterMapping = Map<number, Map<string, string>>;

export class OcrRequiredError extends Error {
  constructor(public filePath: string) {
    super(
      '当前文档未能提取出可识别文本。请先整理为可编辑的 Markdown 或文本内容后再识别。',
    );
    this.name = 'OcrRequiredError';
  }
}

export class QuestionIntegrityError extends Error {
  constructor(
    public expected: number,
    public actual: number,
    public missing: string[],
  ) {
    super(
      `题目完整性校验未通过：源文档检测到 ${expected} 个题块，但仅成功结构化 ${actual} 道。` +
      `未完成：${missing.slice(0, 10).join('、')}。为避免静默漏题，本次没有覆盖原题库；` +
      `请检查这些题目附近的原文或更换识别模型后重试。`,
    );
    this.name = 'QuestionIntegrityError';
  }
}

export async function identifyQuestions(
  doc: Document,
  opts: IdentifyOptions = {},
): Promise<ExtractedQuestion[]> {
  const onProgress = opts.onProgress;
  const onAudit = opts.onAudit;
  onProgress?.({ phase: 'parse', message: `正在解析 ${doc.file_type.toUpperCase()} 文档…` });

  let markdown: string;
  if (doc.extracted_markdown && doc.extracted_markdown.trim()) {
    markdown = normalizeStandardMarkdown(doc.extracted_markdown.trim(), opts.standardLang);
    onProgress?.({ phase: 'parse', message: `使用编辑后的 Markdown（${markdown.length} 字符）` });
  } else {
    const parsed = await parseFile(doc.file_path, doc.file_type);
    const text = parsed.text?.trim() ?? '';
    if (!hasMeaningfulDocumentText(text)) throw new OcrRequiredError(doc.file_path);
    markdown = normalizeStandardMarkdown(textToMarkdown(text, opts.standardLang), opts.standardLang);
    onProgress?.({ phase: 'parse', message: `已转换为 Markdown，共 ${markdown.length} 字符` });
  }

  const structured = segmentQuestionDocument(markdown);
  if (structured.blocks.length > 0) {
    return identifyStructuredBlocks(doc, structured.blocks, {
      concurrency: opts.concurrency ?? 3,
      onProgress,
      onAudit,
    });
  }

  return identifyUnstructuredText(doc, markdown, opts);
}

function hasMeaningfulDocumentText(text: string): boolean {
  return text
    .replace(/^\s*\[\[(?:PDF\s+)?PAGE\s+\d+\]\]\s*$/gim, '')
    .trim().length > 0;
}

async function identifyStructuredBlocks(
  doc: Document,
  blocks: SourceQuestionBlock[],
  opts: {
    concurrency: number;
    onProgress?: (p: IdentifyProgress) => void;
    onAudit?: (event: IdentifyAuditEvent) => void;
  },
): Promise<ExtractedQuestion[]> {
  const provider = getLLMProvider();
  const parsed: Array<ExtractedQuestion | null> = blocks.map(() => null);

  // 在交给 LLM 之前，把非 A/B/C/D 的选项前缀强制重编号为 A/B/C/D，
  // 避免模型被 R/C/T/L 这类内容相关前缀误导。
  const { blocks: normalizedBlocks, mappings } = normalizeOptionLetters(blocks);
  const blockToOriginal = new Map<number, SourceQuestionBlock>();
  for (let i = 0; i < blocks.length; i++) {
    blockToOriginal.set(normalizedBlocks[i].index, blocks[i]);
  }

  const batches = createBlockBatches(normalizedBlocks, 4, 6500);
  opts.onProgress?.({
    phase: 'llm',
    message: `Markdown 已切分为 ${normalizedBlocks.length} 个题块，正分 ${batches.length} 批交给 AI 结构化…`,
    current: 0,
    total: batches.length,
  });

  let completed = 0;
  const batchResults = await mapWithConcurrency(batches, opts.concurrency, async (batch, batchIndex) => {
    let items: ExtractedQuestion[] = [];
    try {
      items = await provider.identifyQuestions({
        text: renderBlockMarkdown(batch),
        hint:
          `${doc.title}。本批恰好包含 ${batch.length} 个 Markdown 题块；` +
          '逐题理解题型、题干、选项、答案与解析，严格保留每个 QUESTION_ID，输出题数必须与题块数一致。' +
          '所有选择题选项均已规范为 A/B/C/D 前缀，answer 必须是对应字母。',
      });
    } catch {
      // 批处理失败时不丢题，下面会逐题重试。
      opts.onAudit?.({
        severity: 'error',
        stage: 'batch',
        message: `第 ${batchIndex + 1}/${batches.length} 批调用模型失败，将转入逐题重试。`,
        source_ids: batch.map(sourceId),
        batch_index: batchIndex + 1,
        batch_total: batches.length,
        preview: trimBlockPreview(batch),
      });
    }
    const matched = matchBatchResults(batch, items, mappings);
    if (items.length > 0 && matched.length !== batch.length) {
      opts.onAudit?.({
        severity: 'warning',
        stage: 'batch',
        message:
          `第 ${batchIndex + 1}/${batches.length} 批返回 ${items.length} 道，` +
          `可靠匹配 ${matched.length}/${batch.length} 道，将补做未匹配题块。`,
        source_ids: batch.map(sourceId),
        batch_index: batchIndex + 1,
        batch_total: batches.length,
        raw_question_count: items.length,
        matched_question_count: matched.length,
        preview: trimBlockPreview(batch),
      });
    }
    completed++;
    opts.onProgress?.({
      phase: 'llm',
      message: `AI 已处理 ${completed}/${batches.length} 批`,
      current: completed,
      total: batches.length,
    });
    return matched.map(({ index, item }) => ({
      index,
      item,
      originalBlock: blockToOriginal.get(index)!,
    }));
  });

  for (const matched of batchResults) {
    for (const { index, item, originalBlock } of matched) {
      parsed[index] = applyBlockMetadata(item, originalBlock);
    }
  }

  const unresolved = normalizedBlocks.filter((block) => !parsed[block.index]);
  if (unresolved.length > 0) {
    opts.onProgress?.({
      phase: 'llm',
      message: `发现 ${unresolved.length} 个题块未可靠对应，正在逐题重试…`,
      current: 0,
      total: unresolved.length,
    });
    completed = 0;
    const recovered = await mapWithConcurrency(unresolved, opts.concurrency, async (block) => {
      const mapping = mappings.get(block.index);
      const item = await identifySingleBlock(doc, block, mapping, opts.onAudit);
      completed++;
      opts.onProgress?.({
        phase: 'llm',
        message: `已逐题复核 ${completed}/${unresolved.length} 道`,
        current: completed,
        total: unresolved.length,
      });
      return { index: block.index, item };
    });
    for (const { index, item } of recovered) {
      if (item) parsed[index] = applyBlockMetadata(item, blockToOriginal.get(index)!);
    }
  }

  const result = parsed.filter((q): q is ExtractedQuestion => Boolean(q));
  const missing = blocks
    .filter((block) => !parsed[block.index])
    .map(describeBlock);
  if (result.length !== blocks.length && missing.length > 0) {
    opts.onAudit?.({
      severity: 'error',
      stage: 'integrity',
      message: `完整性校验失败：题块 ${blocks.length}，成功结构化 ${result.length}。`,
      source_ids: blocks.filter((block) => !parsed[block.index]).map(sourceId),
      raw_question_count: blocks.length,
      matched_question_count: result.length,
      preview: missing.slice(0, 6).join('；'),
    });
    throw new QuestionIntegrityError(blocks.length, result.length, missing);
  }

  opts.onProgress?.({ phase: 'merge', message: '正在进行题号连续性与完整性审计…' });
  opts.onProgress?.({
    phase: 'done',
    message: `结构校验通过：${result.length}/${blocks.length} 道题完整`,
    current: result.length,
    total: blocks.length,
  });
  return result;
}

function createBlockBatches(
  blocks: SourceQuestionBlock[],
  maxQuestions: number,
  maxChars: number,
): SourceQuestionBlock[][] {
  const batches: SourceQuestionBlock[][] = [];
  let current: SourceQuestionBlock[] = [];
  let chars = 0;
  for (const block of blocks) {
    const size = block.text.length + (block.heading?.length ?? 0) + 100;
    if (current.length > 0 && (current.length >= maxQuestions || chars + size > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(block);
    chars += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function normalizeOptionLetters(
  blocks: SourceQuestionBlock[],
): { blocks: SourceQuestionBlock[]; mappings: OptionLetterMapping } {
  const mappings: OptionLetterMapping = new Map();

  // 匹配答案行：答案[:：] X，X 为单个字母
  const ANSWER_LETTER_RE = /^(\s*(?:[-*+]\s*)?(?:[【\[]\s*)?(?:参考答案|正确答案|标准答案|答案|答)\s*[:：]?\s*)([A-Za-z])(\s*.*)$/i;

  const normalized = blocks.map((block) => {
    const lines = block.text.split(/\r?\n/);
    const originalLetters: string[] = [];
    const lineReplacements: Array<{ index: number; original: string; replacement: string }> = [];

    lines.forEach((line, lineIdx) => {
      const match = line.match(/^\s*(?:[-*+]\s*)?[（(]?\s*([A-Za-z])\s*[）).、．:：\]】]\s*(.*)$/);
      if (match) {
        originalLetters.push(match[1].toUpperCase());
        const replacementLetter = String.fromCharCode(65 + originalLetters.length - 1);
        const prefix = line.slice(0, match.index ?? 0);
        lineReplacements.push({
          index: lineIdx,
          original: match[1],
          replacement: `${prefix}${replacementLetter}. ${match[2]}`,
        });
      }
    });

    if (originalLetters.length === 0 || isSequentialLetters(originalLetters)) {
      return block;
    }

    const mapping = new Map<string, string>();
    originalLetters.forEach((letter, idx) => {
      mapping.set(letter.toUpperCase(), String.fromCharCode(65 + idx));
    });
    mappings.set(block.index, mapping);

    // 替换选项行前缀
    const newLines = [...lines];
    for (const rep of lineReplacements) {
      newLines[rep.index] = rep.replacement;
    }

    // 替换答案行中的字母引用（如 "答案：T" → "答案：C"）
    for (let i = 0; i < newLines.length; i++) {
      const ansMatch = newLines[i].match(ANSWER_LETTER_RE);
      if (ansMatch) {
        const letter = ansMatch[2].toUpperCase();
        const newLetter = mapping.get(letter);
        if (newLetter && newLetter !== letter) {
          newLines[i] = `${ansMatch[1]}${newLetter}${ansMatch[3]}`;
        }
      }
    }

    return {
      ...block,
      text: newLines.join('\n'),
    };
  });

  return { blocks: normalized, mappings };
}

function isSequentialLetters(letters: string[]): boolean {
  return letters.every((l, i) => l.charCodeAt(0) === 65 + i);
}

function remapOptionAnswer(
  question: ExtractedQuestion,
  mapping: Map<string, string>,
): ExtractedQuestion {
  const answer = question.answer.trim();
  const lettersOnly = answer.replace(/[\s,，、;；/]+/g, '');
  if (!/^[A-Za-z]+$/.test(lettersOnly)) return question;

  // LLM 看到的是已归一化为 A/B/C/D 的选项，因此通常应直接信任其返回的字母。
  // 只有当答案字母超出了当前选项的合法范围（如原题答案是 T，而 T 不可能是 A-D 中的有效位置）
  // 才把它当作原题字母进行回映射。
  const optionCount = question.options?.length ?? 0;
  const remapped = [...lettersOnly]
    .map((l) => {
      const upper = l.toUpperCase();
      const normalizedIdx = upper.charCodeAt(0) - 65;
      if (normalizedIdx >= 0 && normalizedIdx < optionCount) return upper;
      return mapping.get(upper) ?? upper;
    })
    .join('');
  return { ...question, answer: remapped };
}

function sourceId(block: SourceQuestionBlock): string {
  return `q${block.index + 1}`;
}

function renderBlockMarkdown(blocks: SourceQuestionBlock[]): string {
  return blocks
    .map((block) => [
      block.heading ? `## ${block.heading}` : '',
      `<!-- QUESTION_ID:${sourceId(block)}${block.page ? ` PAGE:${block.page}` : ''} -->`,
      `### ${block.number ? `${block.number}. ` : ''}${block.text}`,
    ].filter(Boolean).join('\n'))
    .join('\n\n');
}

function matchBatchResults(
  blocks: SourceQuestionBlock[],
  items: ExtractedQuestion[],
  mappings?: OptionLetterMapping,
): Array<{ index: number; item: ExtractedQuestion }> {
  const usable = items.filter(isUsableQuestion);
  const byId = new Map(usable.filter((item) => item.source_id).map((item) => [item.source_id, item]));
  const matched: Array<{ index: number; item: ExtractedQuestion }> = [];
  const used = new Set<ExtractedQuestion>();

  for (const block of blocks) {
    const item = byId.get(sourceId(block));
    if (!item || used.has(item)) continue;
    used.add(item);
    const mapping = mappings?.get(block.index);
    matched.push({ index: block.index, item: mapping ? remapOptionAnswer(item, mapping) : item });
  }

  // 兼容暂未遵循 source_id 的模型：仅在题数完全一致时按原顺序安全对应。
  if (matched.length === 0 && usable.length === blocks.length) {
    return blocks.map((block, index) => ({
      index: block.index,
      item: (() => {
        const mapping = mappings?.get(block.index);
        return mapping ? remapOptionAnswer(usable[index], mapping) : usable[index];
      })(),
    }));
  }
  return matched;
}

async function identifySingleBlock(
  doc: Document,
  block: SourceQuestionBlock,
  mapping?: Map<string, string>,
  onAudit?: (event: IdentifyAuditEvent) => void,
): Promise<ExtractedQuestion | null> {
  const provider = getLLMProvider();
  const source = renderBlockMarkdown([block]);
  const baseHint =
    `${doc.title} · ${describeBlock(block)}。这是一个独立 Markdown 题块，只返回这一道题；` +
    `source_id 必须为 ${sourceId(block)}。题号、选项、答案或解析可能换行、缺少空格或使用全角标点，请容错还原。` +
    '本题选项已规范为 A/B/C/D 前缀，answer 必须填对应字母。最多返回 1 道题。';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const items = await provider.identifyQuestions({
        text: source,
        hint:
          attempt === 1
            ? baseHint
            : `${baseHint} 上次未得到完整结果；请优先依据 Type 字段和题目内容恢复结构，并确保 stem、type、answer 完整。`,
      });
      const candidate = items.find(
        (item) => isUsableQuestion(item) && (!item.source_id || item.source_id === sourceId(block)),
      );
      if (candidate) {
        return mapping ? remapOptionAnswer(candidate, mapping) : candidate;
      }
    } catch {
      // 单题第一次失败时重试；第二次失败由完整性审计统一报告。
    }
  }
  onAudit?.({
    severity: 'error',
    stage: 'single',
    message: `${describeBlock(block)} 逐题重试两次后仍未得到可用结果。`,
    source_ids: [sourceId(block)],
    preview: trimBlockPreview([block]),
  });
  return null;
}

function applyBlockMetadata(
  question: ExtractedQuestion,
  block: SourceQuestionBlock,
): ExtractedQuestion {
  // 题型与内容结构由模型判断；本地只做选项/答案格式归一化和来源元数据补齐。
  // 注意：所有非标准选项前缀已在交给 LLM 前被归一化为 A/B/C/D，
  // 因此这里只需要去掉标准前缀，不需要再次重排。
  const type = question.type;
  const options = isOptionQuestion(type)
    ? normalizeChoiceOptions(
        type === 'judge' ? question.options ?? ['正确', '错误'] : question.options,
      ) ?? undefined
    : undefined;

  let answer = question.answer.trim();
  if (type === 'judge') {
    if (/^(?:对|正确|是|√|true)$/i.test(answer)) answer = 'A';
    else if (/^(?:错|错误|否|×|x|false)$/i.test(answer)) answer = 'B';
    else answer = normalizeChoiceAnswer(answer, options);
  } else if (type === 'choice' || type === 'multiple') {
    answer = normalizeChoiceAnswer(answer, options);
  }

  return {
    ...question,
    type,
    options,
    answer,
    page_or_section:
      question.page_or_section ||
      [block.heading, block.page ? `PDF 第 ${block.page} 页` : null]
        .filter(Boolean)
        .join(' · ') ||
      undefined,
  };
}

function isUsableQuestion(question: ExtractedQuestion): boolean {
  if (
    typeof question.stem !== 'string' ||
    !question.stem.trim() ||
    typeof question.answer !== 'string' ||
    !question.answer.trim()
  ) return false;
  if (isOptionQuestion(question.type)) {
    return Boolean(question.options && question.options.length >= 2);
  }
  return true;
}

async function identifyUnstructuredText(
  doc: Document,
  text: string,
  opts: IdentifyOptions,
): Promise<ExtractedQuestion[]> {
  const provider = getLLMProvider();
  const threshold = opts.chunkThreshold ?? 1400;
  const chunkSize = opts.chunkSize ?? 1800;
  const concurrency = opts.concurrency ?? 3;
  const onProgress = opts.onProgress;

  if (text.length <= threshold) {
    onProgress?.({ phase: 'llm', message: '正在调用 AI 识别非标准文档…', current: 1, total: 1 });
    const items = await provider.identifyQuestions({
      text,
      hint: `${doc.title}。原文没有稳定题号，请根据语义识别题目。`,
    });
    const result = dedupeQuestions(items.filter(isUsableQuestion));
    if (result.length === 0) {
      opts.onAudit?.({
        severity: 'warning',
        stage: 'identify',
        message: '非结构化识别未得到可用题目。',
        preview: trimTextPreview(text),
      });
    }
    onProgress?.({ phase: 'done', message: `识别完成，共 ${result.length} 道题` });
    return result;
  }

  const chunks = splitText(text, { maxChars: chunkSize, overlapChars: 260 });
  onProgress?.({
    phase: 'llm',
    message: `未发现稳定题号，正分 ${chunks.length} 段进行语义识别…`,
    current: 0,
    total: chunks.length,
  });
  let completed = 0;
  const results = await mapWithConcurrency(chunks, concurrency, async (chunk) => {
    let items: ExtractedQuestion[] = [];
    try {
      items = await provider.identifyQuestions({
        text: chunk.text,
        hint: `${doc.title} · 块 ${chunk.index + 1}/${chunks.length}。原文格式不规则，请识别本块所有完整题目，最多返回 8 道。`,
      });
    } catch {
      opts.onAudit?.({
        severity: 'error',
        stage: 'batch',
        message: `非结构化块 ${chunk.index + 1}/${chunks.length} 调用模型失败。`,
        batch_index: chunk.index + 1,
        batch_total: chunks.length,
        preview: trimTextPreview(chunk.text),
      });
      throw new Error(`非结构化块 ${chunk.index + 1} 识别失败`);
    }
    completed++;
    onProgress?.({
      phase: 'llm',
      message: `已识别 ${completed}/${chunks.length} 段`,
      current: completed,
      total: chunks.length,
    });
    return items.filter(isUsableQuestion);
  });
  onProgress?.({ phase: 'merge', message: '合并重叠分段并检查重复题目…' });
  const merged = dedupeQuestions(results.flat());
  onProgress?.({ phase: 'done', message: `识别完成，共 ${merged.length} 道题` });
  return merged;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

function trimTextPreview(text: string, max = 240): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function trimBlockPreview(blocks: SourceQuestionBlock[]): string {
  return trimTextPreview(blocks.map((block) => block.text).join('\n'));
}

function describeBlock(block: SourceQuestionBlock): string {
  const parts = [block.heading, block.number ? `第 ${block.number} 题` : null, block.page ? `PDF 第 ${block.page} 页` : null];
  return parts.filter(Boolean).join(' / ') || `题块 ${block.index + 1}`;
}

function stemKey(question: ExtractedQuestion): string {
  return [
    question.stem,
    ...(question.options ?? []),
    question.answer,
  ]
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function dedupeQuestions(items: ExtractedQuestion[]): ExtractedQuestion[] {
  const seen = new Map<string, ExtractedQuestion>();
  for (const question of items) {
    if (!isUsableQuestion(question)) continue;
    const key = stemKey(question);
    const existing = seen.get(key);
    if (!existing || (!existing.explanation && question.explanation)) {
      seen.set(key, question);
    }
  }
  return [...seen.values()];
}
