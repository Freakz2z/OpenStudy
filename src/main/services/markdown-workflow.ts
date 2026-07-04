import { textToMarkdown } from './parser/markdown.js';
import type { ParsedDoc } from './parser/index.js';
import {
  normalizeMarkdownStandardLanguage,
  type MarkdownStandardLanguage,
} from '../../shared/markdown-standard.js';

export function parsedDocToMarkdown(
  parsed: ParsedDoc,
  lang?: string | MarkdownStandardLanguage | null,
): string {
  const standardLang = normalizeMarkdownStandardLanguage(lang);
  return (parsed.markdown?.trim()
    ? parsed.markdown
    : textToMarkdown(parsed.text ?? '', standardLang))
    .trim();
}
