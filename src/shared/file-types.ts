import { extname } from 'node:path';
import type { FileType } from './types.js';

export const FILE_TYPE_EXTENSIONS: Record<FileType, string[]> = {
  txt: ['.txt'],
  md: ['.md', '.markdown'],
  pdf: ['.pdf'],
  docx: ['.docx'],
  pptx: ['.pptx'],
  html: ['.html', '.htm'],
  csv: ['.csv'],
  xlsx: ['.xlsx'],
  xls: ['.xls'],
  epub: ['.epub'],
  png: ['.png'],
  jpg: ['.jpg', '.jpeg'],
  webp: ['.webp'],
};

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  txt: 'Text',
  md: 'Markdown',
  pdf: 'PDF',
  docx: 'Word',
  pptx: 'PowerPoint',
  html: 'HTML',
  csv: 'CSV',
  xlsx: 'Excel',
  xls: 'Excel 97-2003',
  epub: 'EPUB',
  png: 'PNG',
  jpg: 'JPEG',
  webp: 'WebP',
};

export const ALL_SUPPORTED_EXTENSIONS = Object.values(FILE_TYPE_EXTENSIONS)
  .flat()
  .map((ext) => ext.slice(1));

export function fileTypeOf(filePath: string): FileType | null {
  const ext = extname(filePath).toLowerCase();
  const match = (Object.entries(FILE_TYPE_EXTENSIONS) as Array<[FileType, string[]]>).find(
    ([, extensions]) => extensions.includes(ext),
  );
  return match?.[0] ?? null;
}

export function isMarkItDownPreferredFileType(fileType: FileType): boolean {
  return !['txt', 'md'].includes(fileType);
}
