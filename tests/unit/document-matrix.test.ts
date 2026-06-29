import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { parseFile } from '../../src/main/services/parser/index.js';
import { segmentQuestionDocument } from '../../src/main/services/question-structure.js';
import { analyzeMarkdownPrecheck } from '../../src/shared/question-diagnostics.js';
import type { FileType } from '../../src/shared/types.js';
import type { Document } from '../../src/shared/types.js';
import { parsedDocToMarkdown } from '../../src/main/services/markdown-workflow.js';

const identifyMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/main/services/llm/index.js', () => ({
  getLLMProvider: () => ({ identifyQuestions: identifyMock }),
}));

import { identifyQuestions } from '../../src/main/services/identifier.js';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wordParagraph(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

async function makeDocx(path: string): Promise<void> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`,
  );
  const tableQuestion = [
    '2. 表格中的正确答案是？',
    'A. 甲',
    'B. 乙',
    '【答案：B】',
  ]
    .map((text) => `<w:tr><w:tc>${wordParagraph(text)}<w:tcPr/></w:tc></w:tr>`)
    .join('');
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${wordParagraph('1 一、单选题（共 2 题）')}
        ${wordParagraph('1. 段落中的题目答案是？')}
        ${wordParagraph('A. 甲')}
        ${wordParagraph('B. 乙')}
        ${wordParagraph('答案：A')}
        <w:tbl>${tableQuestion}</w:tbl>
        ${wordParagraph('附录：答案速查表')}
        ${wordParagraph('1. A  2. B')}
        <w:sectPr/>
      </w:body>
    </w:document>`,
  );
  await writeFile(path, await zip.generateAsync({ type: 'nodebuffer' }));
}

function slideXml(lines: string[]): string {
  const paragraphs = lines
    .map((line) => `<a:p><a:r><a:t>${escapeXml(line)}</a:t></a:r></a:p>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld><p:spTree><p:sp><p:txBody>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld>
    </p:sld>`;
}

async function makePptx(path: string): Promise<void> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  );
  zip.file(
    'ppt/slides/slide1.xml',
    slideXml(['一、单选题', '1. 第一张中的题目', 'A. 甲', 'B. 乙', '答案：A']),
  );
  zip.file(
    'ppt/slides/slide2.xml',
    slideXml(['二、判断题', '1. 第二张重新编号。', '【对】']),
  );
  await writeFile(path, await zip.generateAsync({ type: 'nodebuffer' }));
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function makePdf(lines: string[]): Buffer {
  const stream = [
    'BT',
    '/F1 12 Tf',
    '72 740 Td',
    ...lines.flatMap((line, index) => [
      ...(index > 0 ? ['0 -18 Td'] : []),
      `(${escapePdfText(line)}) Tj`,
    ]),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(Buffer.from(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`));
  }
  const xref = Buffer.concat(chunks).length;
  chunks.push(Buffer.from(
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
      offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('') +
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  ));
  return Buffer.concat(chunks);
}

describe('cross-format Markdown-first matrix', () => {
  let dir: string;
  const files: Array<{ name: string; type: FileType; expected: number }> = [];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'openstudy-document-matrix-'));

    const txt = join(dir, 'irregular.txt');
    await writeFile(
      txt,
      `一、单选题\n（1）全角题号也应识别？\nA、甲 B、乙\n【答案：A】\n\n二、判断题\n第1题 这是判断题。\n【对】`,
      'utf8',
    );
    files.push({ name: txt, type: 'txt', expected: 2 });

    const md = join(dir, 'native.md');
    await writeFile(
      md,
      `## 一、单选题\n\n### 1. Markdown 题目\n- A. 甲\n- B. 乙\n答案：B\n\n## 二、简答题\n### 1. 简述测试目的\n参考答案：发现缺陷。`,
      'utf8',
    );
    files.push({ name: md, type: 'md', expected: 2 });

    const docx = join(dir, 'paragraph-and-table.docx');
    await makeDocx(docx);
    files.push({ name: docx, type: 'docx', expected: 2 });

    const pptx = join(dir, 'restart-numbering.pptx');
    await makePptx(pptx);
    files.push({ name: pptx, type: 'pptx', expected: 2 });

    const pdf = join(dir, 'positioned-text.pdf');
    await writeFile(
      pdf,
      makePdf([
        '1. Which option is correct?',
        'A. Alpha',
        'B. Beta',
        'Answer: B',
        '2. A second PDF question.',
        'A. Yes',
        'B. No',
        'Answer: A',
      ]),
    );
    files.push({ name: pdf, type: 'pdf', expected: 2 });
  });

  beforeEach(() => {
    identifyMock.mockReset();
    identifyMock.mockImplementation(async (input: { text?: string }) => {
      const ids = [...(input.text ?? '').matchAll(/QUESTION_ID:(q\d+)/g)].map((match) => match[1]);
      if (ids.length === 0) {
        return [{ type: 'short', stem: '语义识别题目', answer: '参考答案' }];
      }
      return ids.map((source_id) => ({
        source_id,
        type: 'choice',
        stem: `${source_id} 题目`,
        options: ['甲', '乙'],
        answer: 'A',
      }));
    });
  });

  afterAll(async () => {
    if (process.env.KEEP_OPENSTUDY_FIXTURES === '1') {
      console.log(`fixture-dir=${dir}`);
      return;
    }
    await rm(dir, { recursive: true, force: true });
  });

  it('all supported formats become auditable Markdown question blocks', async () => {
    expect(files).toHaveLength(5);
    for (const fixture of files) {
      const parsed = await parseFile(fixture.name, fixture.type, { source: 'native' });
      const markdown = parsedDocToMarkdown(parsed);
      const blocks = segmentQuestionDocument(markdown).blocks;
      const precheck = analyzeMarkdownPrecheck(markdown);
      expect(blocks, fixture.type).toHaveLength(fixture.expected);
      expect(precheck.estimatedQuestionCount, fixture.type).toBe(fixture.expected);
      expect(markdown.match(/QUESTION_ID:/g), fixture.type).toHaveLength(fixture.expected);
    }
  });

  it('keeps unnumbered material intact for semantic LLM fallback', async () => {
    const path = join(dir, 'unnumbered.txt');
    const source = '问题：为什么需要单元测试？\n参考回答：它能快速验证局部行为。';
    await writeFile(path, source, 'utf8');
    const parsed = await parseFile(path, 'txt', { source: 'native' });
    const markdown = parsedDocToMarkdown(parsed);
    expect(segmentQuestionDocument(markdown).blocks).toHaveLength(0);
    expect(markdown).toContain('为什么需要单元测试');
  });

  it('runs every supported format through Markdown and the LLM contract end to end', async () => {
    for (const [index, fixture] of files.entries()) {
      const doc: Document = {
        id: index + 1,
        file_path: fixture.name,
        file_type: fixture.type,
        title: `fixture-${fixture.type}`,
        imported_at: 0,
        question_count: 0,
      };
      const questions = await identifyQuestions(doc, { concurrency: 2, parseSource: 'native' });
      expect(questions, fixture.type).toHaveLength(fixture.expected);
      expect(questions.every((question) => question.source_id), fixture.type).toBe(true);
    }
  });

  it('rejects a PDF containing only page structure before LLM identification', async () => {
    const path = join(dir, 'image-only-placeholder.pdf');
    await writeFile(path, makePdf([]));
    const doc: Document = {
      id: 99,
      file_path: path,
      file_type: 'pdf',
      title: 'scan',
      imported_at: 0,
      question_count: 0,
    };
    await expect(identifyQuestions(doc)).rejects.toThrow(/Markdown|可识别文本/);
    expect(identifyMock).not.toHaveBeenCalled();
  });
});
