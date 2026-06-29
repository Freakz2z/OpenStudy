import { basename, extname } from 'node:path';
import { stat } from 'node:fs/promises';
import { fileTypeOf, ALL_SUPPORTED_EXTENSIONS } from '../../shared/file-types.js';
import type { Document } from '../../shared/types.js';
import { insertDocument } from './db.js';

export const DOCUMENT_IMPORT_FILTERS = [
  { name: 'OpenStudy 支持的文件', extensions: ALL_SUPPORTED_EXTENSIONS },
];

export async function importDocumentFromFile(
  filePath: string,
  title?: string,
): Promise<Document> {
  const fileType = fileTypeOf(filePath);
  if (!fileType) {
    throw new Error(`不支持的文件类型: ${filePath}`);
  }
  await stat(filePath);
  return insertDocument(filePath, fileType, title ?? basename(filePath, extname(filePath)));
}
