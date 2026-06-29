import mammoth from 'mammoth';
import { readFile } from 'node:fs/promises';

export async function parseDocx(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer: data });
  return result.value;
}
