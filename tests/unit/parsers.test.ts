import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { parseText } from '../../src/main/services/parser/text.js';
import { parseDocx } from '../../src/main/services/parser/docx.js';
import { parsePptx } from '../../src/main/services/parser/pptx.js';
import { isScannedPdf, reconstructPdfText } from '../../src/main/services/parser/pdf.js';

describe('text parser', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'openstudy-text-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads utf-8 text file', async () => {
    const p = join(dir, 'a.txt');
    await writeFile(p, '你好，世界\n第二行', 'utf-8');
    expect(await parseText(p)).toBe('你好，世界\n第二行');
  });

  it('reads markdown file', async () => {
    const p = join(dir, 'a.md');
    await writeFile(p, '# 标题\n\n正文内容', 'utf-8');
    expect(await parseText(p)).toContain('正文内容');
  });

  it('throws on missing file', async () => {
    await expect(parseText(join(dir, 'nope.txt'))).rejects.toThrow();
  });
});

describe('pptx parser', () => {
  it('extracts text from each slide in order', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openstudy-pptx-'));
    try {
      const zip = new JSZip();
      zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      );
      // 用真实的 PPTX 命名空间 p: 和 a:
      const slide1 = `<?xml version="1.0"?>
        <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
               xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <p:cSld>
            <p:spTree>
              <p:sp>
                <p:txBody>
                  <a:p><a:r><a:t>第一张幻灯片标题</a:t></a:r></a:p>
                  <a:p><a:r><a:t>1+1=2</a:t></a:r></a:p>
                </p:txBody>
              </p:sp>
            </p:spTree>
          </p:cSld>
        </p:sld>`;
      const slide2 = `<?xml version="1.0"?>
        <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
               xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <p:cSld>
            <p:spTree>
              <p:sp>
                <p:txBody>
                  <a:p><a:r><a:t>第二张幻灯片</a:t></a:r></a:p>
                </p:txBody>
              </p:sp>
            </p:spTree>
          </p:cSld>
        </p:sld>`;
      zip.file('ppt/slides/slide1.xml', slide1);
      zip.file('ppt/slides/slide2.xml', slide2);
      const p = join(dir, 'fake.pptx');
      await writeFile(p, await zip.generateAsync({ type: 'nodebuffer' }));
      const text = await parsePptx(p);
      expect(text).toContain('[Slide 1]');
      expect(text).toContain('第一张幻灯片标题');
      expect(text).toContain('[Slide 2]');
      expect(text).toContain('第二张幻灯片');
      expect(text.indexOf('Slide 1')).toBeLessThan(text.indexOf('Slide 2'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('handles pptx with no slides gracefully', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openstudy-pptx-'));
    try {
      const zip = new JSZip();
      zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      );
      const p = join(dir, 'empty.pptx');
      await writeFile(p, await zip.generateAsync({ type: 'nodebuffer' }));
      const text = await parsePptx(p);
      expect(text).toBe('');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('throws on invalid pptx', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openstudy-pptx-'));
    try {
      const p = join(dir, 'fake.pptx');
      await writeFile(p, 'not a real pptx');
      await expect(parsePptx(p)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('docx parser', () => {
  it('throws on invalid docx', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openstudy-docx-'));
    try {
      const p = join(dir, 'fake.docx');
      await writeFile(p, 'not a real docx');
      await expect(parseDocx(p)).rejects.toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('isScannedPdf', () => {
  // 注意：构造一个真正的 PDF 太复杂，这里只验证非 PDF 文件抛错行为
  it('throws on non-pdf file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openstudy-scan-'));
    try {
      const p = join(dir, 'fake.pdf');
      await writeFile(p, 'not a real pdf');
      await expect(isScannedPdf(p)).rejects.toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('reconstructPdfText', () => {
  it('按坐标还原行内顺序与换行', () => {
    const text = reconstructPdfText([
      { str: '第二行', transform: [1, 0, 0, 1, 10, 680], width: 24, height: 12 },
      { str: '北京', transform: [1, 0, 0, 1, 40, 700], width: 16, height: 12 },
      { str: 'A.', transform: [1, 0, 0, 1, 10, 700], width: 12, height: 12 },
      { str: '答案', transform: [1, 0, 0, 1, 10, 650], width: 24, height: 12 },
    ]);
    expect(text).toBe('A. 北京\n第二行\n\n答案');
  });
});
