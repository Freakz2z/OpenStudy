// 文档文本转 Markdown 工具
// 用途：编辑原文件功能。让用户看到/编辑解析后的内容。
import { segmentQuestionDocument } from '../question-structure.js';
import {
  detectMarkdownStandardLanguage,
  inferQuestionTypeFromHeading,
  normalizeSectionHeading,
  normalizeStandardMarkdown,
  STANDARD_FIELD_LABELS,
  STANDARD_TYPE_VALUES,
  type MarkdownStandardLanguage,
} from '../../../shared/markdown-standard.js';

/**
 * 将解析器返回的纯文本转换为结构化 Markdown。
 * 启发式规则：
 * - 多行连续短行（<60 字符）识别为标题层级
 * - 包含「一、」「1.」「第 X 题」开头的行识别为题目分隔
 * - 数字列表（1. 2. 3.）保留为有序列表
 * - 其他段落保持为普通段落
 */
export function textToMarkdown(
  text: string,
  preferredLang?: MarkdownStandardLanguage,
): string {
  const lang = preferredLang ?? detectMarkdownStandardLanguage(text);
  const structured = segmentQuestionDocument(text);
  if (structured.blocks.length > 0) {
    const out: string[] = [];
    let previousHeading: string | null = null;
    for (const block of structured.blocks) {
      const normalizedHeading = block.heading
        ? normalizeSectionHeading(block.heading, lang)
        : null;
      const blockType = block.heading ? inferQuestionTypeFromHeading(block.heading) : null;
      if (normalizedHeading && normalizedHeading !== previousHeading) {
        out.push(`## ${normalizedHeading}`, '');
        previousHeading = normalizedHeading;
      }
      const lines = block.text.split(/\r?\n/);
      const first = lines.shift()?.trim() ?? '';
      out.push(`<!-- QUESTION_ID:q${block.index + 1}${block.page ? ` PAGE:${block.page}` : ''} -->`);
      out.push(`### ${block.number ? `${block.number}. ` : ''}${first}`.trim());
      if (lines.length > 0) out.push(...lines);
      if (blockType) out.push(`${STANDARD_FIELD_LABELS.type}: ${STANDARD_TYPE_VALUES[blockType]}`);
      out.push('');
    }
    return normalizeStandardMarkdown(
      out.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
      lang,
    );
  }

  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      // 合并连续空行
      if (out.length > 0 && out[out.length - 1] !== '') {
        out.push('');
      }
      continue;
    }

    // 题目分隔
    if (/^(第\s*[一二三四五六七八九十0-9]+\s*[题章节]|[一二三四五六七八九十]+[、.]|\d+\.\s)/.test(trimmed)) {
      out.push(`## ${trimmed}`);
      continue;
    }

    // 短行可能是标题（< 40 字符且全行没有标点结尾）
    if (trimmed.length < 40 && !/[.!?;,]$/.test(trimmed) && i < lines.length - 1) {
      const next = lines[i + 1]?.trim() ?? '';
      if (!next) {
        out.push(`### ${trimmed}`);
        continue;
      }
    }

    out.push(trimmed);
  }

  return normalizeStandardMarkdown(out.join('\n').trim(), lang);
}

/**
 * 将 Markdown 转回纯文本（用于 LLM 输入）。
 * 简单去掉 markdown 标记即可，因为 LLM 能理解 markdown。
 */
export function markdownToText(md: string): string {
  return md
    // 去掉 ATX 标题标记
    .replace(/^#{1,6}\s+/gm, '')
    // 去掉粗体/斜体标记
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // 保留列表项的文本内容
    .replace(/^[\s]*[-*+]\s+/gm, '')
    // 数字列表很可能就是题号，不能删除；否则后续无法做题号连续性审计。
    .trim();
}
