import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type {
  Document,
  Question,
  WrongQuestion,
  FileType,
  QuestionAttemptSnapshot,
  RecentAttemptDetail,
} from '../../shared/types.js';
import {
  isOptionQuestion,
  normalizeChoiceAnswer,
  normalizeChoiceOptions,
} from '../../shared/question-format.js';
import { resolveAppDataDir } from './runtime-paths.js';

let db: Database.Database | null = null;

const MIGRATIONS = [
  // v1
  `
  CREATE TABLE IF NOT EXISTS documents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path     TEXT    NOT NULL,
    file_type     TEXT    NOT NULL,
    title         TEXT    NOT NULL,
    imported_at   INTEGER NOT NULL,
    question_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS questions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id   INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    type          TEXT    NOT NULL,
    stem          TEXT    NOT NULL,
    options_json  TEXT,
    answer        TEXT    NOT NULL,
    explanation   TEXT,
    page_or_section TEXT,
    position      INTEGER NOT NULL,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_questions_doc ON questions(document_id);

  CREATE TABLE IF NOT EXISTS attempts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_answer   TEXT    NOT NULL,
    is_correct    INTEGER NOT NULL,
    attempted_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_correct ON attempts(is_correct);

  CREATE VIEW IF NOT EXISTS wrong_questions AS
    SELECT q.*, a.user_answer AS last_wrong_answer, a.attempted_at AS last_wrong_at
    FROM questions q
    JOIN attempts a ON a.question_id = q.id
    WHERE a.is_correct = 0
      AND a.id = (SELECT MAX(a2.id) FROM attempts a2
                  WHERE a2.question_id = q.id AND a2.is_correct = 0);
  `,
];

// v2 迁移：编辑原文件功能 —— 文档保存解析后的 Markdown
// 用单独函数 + PRAGMA user_version 跟踪版本，避免重复执行 ALTER 失败
const MIGRATIONS_V2 = [
  `ALTER TABLE documents ADD COLUMN extracted_markdown TEXT;`,
];

function runMigrations(): void {
  const d = getDb();
  const currentVersion = (
    d.pragma('user_version', { simple: true }) as number
  ) ?? 0;
  for (let v = currentVersion; v < MIGRATIONS_V2.length; v++) {
    const sql = MIGRATIONS_V2[v];
    if (!sql) continue;
    try {
      d.exec(sql);
    } catch (e) {
      // 重复执行已应用的迁移时静默忽略（如列已存在）
      // eslint-disable-next-line no-console
      console.warn(`[migrations] v${v + 2} skipped:`, (e as Error).message);
    }
    d.pragma(`user_version = ${v + 1}`);
  }
}

export function getDb(): Database.Database {
  if (db) return db;
  const userData = resolveAppDataDir();
  if (!existsSync(userData)) mkdirSync(userData, { recursive: true });
  const dbPath = join(userData, 'openstudy.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const m of MIGRATIONS) db.exec(m);
  runMigrations();
  return db;
}

// ---------- 文档 ----------

export function insertDocument(
  filePath: string,
  fileType: FileType,
  title: string,
): Document {
  const d = getDb();
  const now = Date.now();
  const info = d
    .prepare(
      `INSERT INTO documents (file_path, file_type, title, imported_at, question_count)
       VALUES (?, ?, ?, ?, 0)`,
    )
    .run(filePath, fileType, title, now);
  return {
    id: info.lastInsertRowid as number,
    file_path: filePath,
    file_type: fileType,
    title,
    imported_at: now,
    question_count: 0,
  };
}

export function listDocuments(): Document[] {
  const d = getDb();
  return d
    .prepare(`SELECT * FROM documents ORDER BY imported_at DESC`)
    .all() as Document[];
}

export function getDocument(id: number): Document | undefined {
  return getDb().prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as
    | Document
    | undefined;
}

// 更新文档的 Markdown 文本（编辑原文件功能）
export function setExtractedMarkdown(id: number, markdown: string): void {
  getDb()
    .prepare(`UPDATE documents SET extracted_markdown = ? WHERE id = ?`)
    .run(markdown, id);
}

export function deleteDocument(id: number): void {
  getDb().prepare(`DELETE FROM documents WHERE id = ?`).run(id);
}

export function updateQuestionCount(docId: number): void {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM questions WHERE document_id = ?`)
    .get(docId) as { c: number };
  getDb()
    .prepare(`UPDATE documents SET question_count = ? WHERE id = ?`)
    .run(row.c, docId);
}

// ---------- 题目 ----------

export function insertQuestions(
  docId: number,
  items: Array<{
    type: string;
    stem: string;
    options_json: string | null;
    answer: string;
    explanation: string | null;
    page_or_section: string | null;
    position: number;
  }>,
): void {
  const d = getDb();
  const insert = d.prepare(
    `INSERT INTO questions
     (document_id, type, stem, options_json, answer, explanation, page_or_section, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = d.transaction((rows: typeof items) => {
    for (const r of rows) {
      const normalizedOptions =
        isOptionQuestion(r.type as Question['type']) && r.options_json
          ? normalizeChoiceOptions(JSON.parse(r.options_json) as string[])
          : null;
      insert.run(
        docId,
        r.type,
        r.stem,
        normalizedOptions ? JSON.stringify(normalizedOptions) : null,
        isOptionQuestion(r.type as Question['type'])
          ? normalizeChoiceAnswer(r.answer, normalizedOptions)
          : r.answer,
        r.explanation,
        r.page_or_section,
        r.position,
        Date.now(),
      );
    }
  });
  tx(items);
  updateQuestionCount(docId);
}

export function listQuestionsByDocument(docId: number): Question[] {
  const rows = getDb()
    .prepare(`SELECT * FROM questions WHERE document_id = ? ORDER BY position`)
    .all(docId) as Array<Omit<Question, 'options'> & { options_json: string | null }>;
  return rows.map((r) => ({
    id: r.id,
    document_id: r.document_id,
    type: r.type,
    stem: r.stem,
    options: r.options_json
      ? normalizeChoiceOptions(JSON.parse(r.options_json) as string[])
      : null,
    answer:
      isOptionQuestion(r.type)
        ? normalizeChoiceAnswer(
            r.answer,
            r.options_json ? (JSON.parse(r.options_json) as string[]) : null,
          )
        : r.answer,
    explanation: r.explanation,
    page_or_section: r.page_or_section,
    position: r.position,
  }));
}

export function getQuestion(qId: number): Question | undefined {
  const row = getDb()
    .prepare(`SELECT * FROM questions WHERE id = ?`)
    .get(qId) as (Omit<Question, 'options'> & { options_json: string | null }) | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    document_id: row.document_id,
    type: row.type,
    stem: row.stem,
    options: row.options_json
      ? normalizeChoiceOptions(JSON.parse(row.options_json) as string[])
      : null,
    answer:
      isOptionQuestion(row.type)
        ? normalizeChoiceAnswer(
            row.answer,
            row.options_json ? (JSON.parse(row.options_json) as string[]) : null,
          )
        : row.answer,
    explanation: row.explanation,
    page_or_section: row.page_or_section,
    position: row.position,
  };
}

export function deleteQuestionsByDocument(docId: number): number {
  const d = getDb();
  const info = d.prepare(`DELETE FROM questions WHERE document_id = ?`).run(docId);
  return info.changes;
}

export interface QuestionUpdate {
  type: Question['type'];
  stem: string;
  options: string[] | null;
  answer: string;
  explanation: string | null;
}

export function updateQuestion(qId: number, patch: QuestionUpdate): void {
  const d = getDb();
  const normalizedOptions =
    isOptionQuestion(patch.type) ? normalizeChoiceOptions(patch.options) : null;
  d.prepare(
    `UPDATE questions
     SET type = ?, stem = ?, options_json = ?, answer = ?, explanation = ?
     WHERE id = ?`,
  ).run(
    patch.type,
    patch.stem,
    normalizedOptions ? JSON.stringify(normalizedOptions) : null,
    isOptionQuestion(patch.type)
      ? normalizeChoiceAnswer(patch.answer, normalizedOptions)
      : patch.answer,
    patch.explanation,
    qId,
  );
}

// ---------- 答题记录 ----------

export function saveAttempt(
  questionId: number,
  userAnswer: string,
  isCorrect: boolean,
): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO attempts (question_id, user_answer, is_correct, attempted_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(questionId, userAnswer, isCorrect ? 1 : 0, Date.now());
  } catch (e) {
    // 不让 SQLite 错误传播到 renderer 渲染崩溃；只记日志
    // eslint-disable-next-line no-console
    console.error('[saveAttempt] failed:', (e as Error).message);
  }
}

export function listWrongQuestions(): WrongQuestion[] {
  const rows = getDb()
    .prepare(
      `SELECT q.*, a.user_answer AS last_wrong_answer, a.attempted_at AS last_wrong_at,
              d.title AS document_title, d.file_type AS document_file_type
       FROM wrong_questions q
       JOIN attempts a ON a.id = (
         SELECT MAX(a2.id) FROM attempts a2
         WHERE a2.question_id = q.id AND a2.is_correct = 0
       )
       JOIN documents d ON d.id = q.document_id
       ORDER BY last_wrong_at DESC`,
    )
    .all() as Array<
    Omit<Question, 'options'> & {
      options_json: string | null;
      last_wrong_answer: string;
      last_wrong_at: number;
      document_title: string;
      document_file_type: string;
    }
  >;
  return rows.map((r) => ({
    id: r.id,
    document_id: r.document_id,
    type: r.type,
    stem: r.stem,
    options: r.options_json
      ? normalizeChoiceOptions(JSON.parse(r.options_json) as string[])
      : null,
    answer:
      isOptionQuestion(r.type)
        ? normalizeChoiceAnswer(
            r.answer,
            r.options_json ? (JSON.parse(r.options_json) as string[]) : null,
          )
        : r.answer,
    explanation: r.explanation,
    page_or_section: r.page_or_section,
    position: r.position,
    last_wrong_answer: r.last_wrong_answer,
    last_wrong_at: r.last_wrong_at,
    document_title: r.document_title,
    document_file_type: r.document_file_type,
  }));
}

export function listLatestAttemptsByDocument(docId: number): QuestionAttemptSnapshot[] {
  return getDb()
    .prepare(
      `SELECT a.question_id, a.user_answer, a.is_correct, a.attempted_at
       FROM attempts a
       JOIN questions q ON q.id = a.question_id
       WHERE q.document_id = ?
         AND a.id = (
           SELECT MAX(a2.id)
           FROM attempts a2
           WHERE a2.question_id = a.question_id
         )
       ORDER BY q.position`,
    )
    .all(docId)
    .map((row) => ({
      question_id: Number((row as { question_id: number }).question_id),
      user_answer: String((row as { user_answer: string }).user_answer ?? ''),
      is_correct: Number((row as { is_correct: number }).is_correct) === 1,
      attempted_at: Number((row as { attempted_at: number }).attempted_at),
    }));
}

export function listRecentAttempts(limit = 80): RecentAttemptDetail[] {
  const rows = getDb()
    .prepare(
      `SELECT
         a.question_id,
         a.user_answer,
         a.is_correct,
         a.attempted_at,
         q.document_id,
         q.type AS question_type,
         q.stem AS question_stem,
         q.answer AS reference_answer,
         d.title AS document_title
       FROM attempts a
       JOIN questions q ON q.id = a.question_id
       JOIN documents d ON d.id = q.document_id
       ORDER BY a.attempted_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
      question_id: number;
      user_answer: string;
      is_correct: number;
      attempted_at: number;
      document_id: number;
      question_type: Question['type'];
      question_stem: string;
      reference_answer: string;
      document_title: string;
    }>;

  return rows.map((row) => ({
    question_id: Number(row.question_id),
    user_answer: String(row.user_answer ?? ''),
    is_correct: Number(row.is_correct) === 1,
    attempted_at: Number(row.attempted_at),
    document_id: Number(row.document_id),
    document_title: String(row.document_title ?? ''),
    question_type: row.question_type,
    question_stem: String(row.question_stem ?? ''),
    reference_answer: String(row.reference_answer ?? ''),
  }));
}

// 删除某题的所有 attempt 历史（让它从错题本消失）
export function deleteAttemptsForQuestion(qId: number): number {
  const info = getDb()
    .prepare(`DELETE FROM attempts WHERE question_id = ?`)
    .run(qId);
  return info.changes;
}

// 清空所有 attempt 历史（重置所有答题记录）
export function clearAllAttempts(): number {
  const info = getDb().prepare(`DELETE FROM attempts`).run();
  return info.changes;
}

// 清空某文档下所有题目的 attempt 历史（重置该文档进度）
export function clearDocumentAttempts(docId: number): number {
  const info = getDb()
    .prepare(
      `DELETE FROM attempts WHERE question_id IN (SELECT id FROM questions WHERE document_id = ?)`,
    )
    .run(docId);
  return info.changes;
}

// ---------- 统计 ----------

export interface DocumentStats {
  question_count: number;
  attempted_count: number; // 至少做过一次的题目数
  correct_count: number;   // 最近一次答对的题目数
  wrong_count: number;     // 最近一次答错的题目数
  accuracy: number | null; // 0..1；attempts=0 时 null
}

export interface OverallStats {
  document_count: number;
  question_count: number;
  attempted_count: number;
  wrong_count: number;     // 错题本中的题目数
  accuracy: number | null; // 0..1；attempts=0 时 null
}

export function getDocumentStats(docId: number): DocumentStats {
  const d = getDb();
  const totalRow = d
    .prepare(`SELECT COUNT(*) AS c FROM questions WHERE document_id = ?`)
    .get(docId) as { c: number };
  const questionCount = totalRow.c;

  // 每个题目最近一次答题结果
  const lastAttemptRows = d
    .prepare(
      `SELECT q.id AS qid, (
         SELECT a.is_correct FROM attempts a
         WHERE a.question_id = q.id
         ORDER BY a.id DESC LIMIT 1
       ) AS last_is_correct
       FROM questions q WHERE q.document_id = ?`,
    )
    .all(docId) as Array<{ qid: number; last_is_correct: number | null }>;

  let attempted = 0;
  let correct = 0;
  let wrong = 0;
  let correctAttempts = 0;
  let totalAttempts = 0;
  for (const r of lastAttemptRows) {
    if (r.last_is_correct == null) continue;
    attempted++;
    if (r.last_is_correct === 1) correct++;
    else wrong++;
  }
  const attemptAgg = d
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(a.is_correct), 0) AS correct
       FROM attempts a
       JOIN questions q ON q.id = a.question_id
       WHERE q.document_id = ?`,
    )
    .get(docId) as { total: number; correct: number };
  totalAttempts = attemptAgg.total;
  correctAttempts = attemptAgg.correct;

  return {
    question_count: questionCount,
    attempted_count: attempted,
    correct_count: correct,
    wrong_count: wrong,
    accuracy: totalAttempts > 0 ? correctAttempts / totalAttempts : null,
  };
}

export function getOverallStats(): OverallStats {
  const d = getDb();
  const docRow = d.prepare(`SELECT COUNT(*) AS c FROM documents`).get() as { c: number };
  const qRow = d.prepare(`SELECT COUNT(*) AS c FROM questions`).get() as { c: number };
  const wrongRow = d
    .prepare(`SELECT COUNT(*) AS c FROM wrong_questions`)
    .get() as { c: number };
  const attemptAgg = d
    .prepare(
      `SELECT
         COUNT(DISTINCT question_id) AS attempted,
         COUNT(*) AS total,
         COALESCE(SUM(is_correct), 0) AS correct
       FROM attempts`,
    )
    .get() as { attempted: number; total: number; correct: number };

  return {
    document_count: docRow.c,
    question_count: qRow.c,
    attempted_count: attemptAgg.attempted,
    wrong_count: wrongRow.c,
    accuracy: attemptAgg.total > 0 ? attemptAgg.correct / attemptAgg.total : null,
  };
}
