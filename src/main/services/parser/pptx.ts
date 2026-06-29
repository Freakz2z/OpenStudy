import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

export async function parsePptx(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  const zip = await JSZip.loadAsync(data);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)![1]);
      const nb = Number(b.match(/slide(\d+)\.xml/)![1]);
      return na - nb;
    });
  const parts: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('text');
    const texts = Array.from(xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)).map(
      (m) => m[1],
    );
    parts.push(`[Slide ${i + 1}]\n${texts.join('\n')}`);
  }
  return parts.join('\n\n');
}
