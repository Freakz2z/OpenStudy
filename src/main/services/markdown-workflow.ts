import { textToMarkdown } from './parser/markdown.js';
import type { ParsedDoc } from './parser/index.js';
import {
  normalizeMarkdownStandardLanguage,
  normalizeStandardMarkdown,
  type MarkdownStandardLanguage,
} from '../../shared/markdown-standard.js';

export function parsedDocToMarkdown(
  parsed: ParsedDoc,
  lang?: string | MarkdownStandardLanguage | null,
): string {
  const standardLang = normalizeMarkdownStandardLanguage(lang);
  const markdown = parsed.markdown?.trim()
    ? parsed.markdown
    : textToMarkdown(parsed.text ?? '', standardLang);
  return normalizeStandardMarkdown(markdown, standardLang);
}
