import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  Document,
  IdentifyAuditEvent,
  IdentifyLogEntry,
  IdentifyLogStatus,
} from '../../shared/types.js';
import { getSettings } from './store.js';
import { resolveAppDataDir } from './runtime-paths.js';

const LOG_FILE_NAME = 'identify-audit.jsonl';

function getLogFilePath(): string {
  return join(resolveAppDataDir(), 'logs', LOG_FILE_NAME);
}

function trimPreview(text: string | null | undefined, max = 1800): string | undefined {
  const normalized = text?.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

export function createIdentifyLogEntry(input: {
  doc: Document;
  status: IdentifyLogStatus;
  message: string;
  estimated_question_count?: number;
  identified_question_count?: number;
  events?: IdentifyAuditEvent[];
  markdown?: string;
  error_name?: string;
}): IdentifyLogEntry {
  const settings = getSettings();
  return {
    id: randomUUID(),
    created_at: Date.now(),
    status: input.status,
    doc_id: input.doc.id,
    doc_title: input.doc.title,
    file_path: input.doc.file_path,
    file_type: input.doc.file_type,
    model_provider: settings.llm.provider,
    model_name: settings.llm.model,
    message: input.message,
    estimated_question_count: input.estimated_question_count,
    identified_question_count: input.identified_question_count,
    events: input.events ?? [],
    markdown_preview: trimPreview(input.markdown),
    error_name: input.error_name,
  };
}

export async function appendIdentifyLog(entry: IdentifyLogEntry): Promise<void> {
  const filePath = getLogFilePath();
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function readIdentifyLogs(): Promise<IdentifyLogEntry[]> {
  const filePath = getLogFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as IdentifyLogEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is IdentifyLogEntry => Boolean(entry));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function writeIdentifyLogs(entries: IdentifyLogEntry[]): Promise<void> {
  const filePath = getLogFilePath();
  await fs.mkdir(dirname(filePath), { recursive: true });
  const content = entries.map((entry) => JSON.stringify(entry)).join('\n');
  await fs.writeFile(filePath, content ? `${content}\n` : '', 'utf8');
}

export async function listIdentifyLogs(opts: {
  docId?: number;
  limit?: number;
} = {}): Promise<IdentifyLogEntry[]> {
  const entries = await readIdentifyLogs();
  return entries
      .filter((entry) => (opts.docId == null ? true : entry.doc_id === opts.docId))
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, Math.max(1, opts.limit ?? 20));
}

export async function deleteIdentifyLog(id: string): Promise<void> {
  const entries = await readIdentifyLogs();
  await writeIdentifyLogs(entries.filter((entry) => entry.id !== id));
}

export async function clearIdentifyLogs(): Promise<void> {
  await writeIdentifyLogs([]);
}
