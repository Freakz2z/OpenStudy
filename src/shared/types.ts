import type { ShortcutSettings } from './shortcuts.js';

export type FileType = 'txt' | 'md' | 'pdf' | 'docx' | 'pptx';
export type QuestionType =
  | 'choice'
  | 'multiple'
  | 'judge'
  | 'fill'
  | 'short'
  | 'code';
export type LLMProviderType =
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'gemini'
  | 'groq'
  | 'xai'
  | 'openrouter';
export type IdentifyLogStatus = 'success' | 'failed';
export type IdentifyLogSeverity = 'info' | 'warning' | 'error';
export type IdentifyLogStage =
  | 'parse'
  | 'batch'
  | 'single'
  | 'merge'
  | 'integrity'
  | 'identify';

export interface AppSettings {
  llm: {
    provider: LLMProviderType;
    baseUrl?: string;
    apiKey?: string;
    model: string;
    visionModel?: string;
  };
  shortcuts: ShortcutSettings;
}

export interface Document {
  id: number;
  file_path: string;
  file_type: FileType;
  title: string;
  imported_at: number;
  question_count: number;
  /** 用户编辑后的 Markdown 文本（编辑原文件功能） */
  extracted_markdown?: string | null;
}

export interface Question {
  id: number;
  document_id: number;
  type: QuestionType;
  stem: string;
  options: string[] | null;
  answer: string;
  explanation: string | null;
  page_or_section: string | null;
  position: number;
}

export interface WrongQuestion extends Question {
  last_wrong_answer: string;
  last_wrong_at: number;
  document_title?: string;
  document_file_type?: string;
}

export interface DocumentStats {
  question_count: number;
  attempted_count: number;
  correct_count: number;
  wrong_count: number;
  accuracy: number | null;
}

export interface OverallStats {
  document_count: number;
  question_count: number;
  attempted_count: number;
  wrong_count: number;
  accuracy: number | null;
}

export interface QuestionAttemptSnapshot {
  question_id: number;
  user_answer: string;
  is_correct: boolean;
  attempted_at: number;
}

export interface RecentAttemptDetail extends QuestionAttemptSnapshot {
  document_id: number;
  document_title: string;
  question_type: QuestionType;
  question_stem: string;
  reference_answer: string;
}

export interface ExtractedQuestion {
  /** LLM 批处理时用于与 Markdown 题块一一对应，不写入数据库。 */
  source_id?: string;
  type: QuestionType;
  stem: string;
  options?: string[];
  answer: string;
  explanation?: string;
  page_or_section?: string;
}

export interface QuestionUpdate {
  type: QuestionType;
  stem: string;
  options: string[] | null;
  answer: string;
  explanation: string | null;
}

export interface IdentifyAuditEvent {
  severity: IdentifyLogSeverity;
  stage: IdentifyLogStage;
  message: string;
  source_ids?: string[];
  batch_index?: number;
  batch_total?: number;
  raw_question_count?: number;
  matched_question_count?: number;
  preview?: string;
}

export interface IdentifyLogEntry {
  id: string;
  created_at: number;
  status: IdentifyLogStatus;
  doc_id: number;
  doc_title: string;
  file_path: string;
  file_type: FileType;
  model_provider: LLMProviderType;
  model_name: string;
  message: string;
  estimated_question_count?: number;
  identified_question_count?: number;
  events: IdentifyAuditEvent[];
  markdown_preview?: string;
  error_name?: string;
}

export type StudyChatRole = 'user' | 'assistant';

export interface StudyChatMessage {
  role: StudyChatRole;
  content: string;
}

export interface PracticeAskRequest {
  question: Pick<Question, 'type' | 'stem' | 'options' | 'answer' | 'explanation'>;
  prompt: string;
  history?: StudyChatMessage[];
  userAnswer?: string | null;
  isCorrect?: boolean | null;
}

export interface PracticeGradeRequest {
  question: Pick<Question, 'type' | 'stem' | 'options' | 'answer' | 'explanation'>;
  userAnswer: string;
}

export interface PracticeGradeResult {
  isCorrect: boolean;
  reason: string;
  mode: 'ai' | 'fallback';
}

export interface ModelTestRequest {
  llm: AppSettings['llm'];
}

export interface ModelTestResult {
  ok: boolean;
  provider: LLMProviderType;
  model: string;
  latencyMs: number;
  message: string;
}

export interface StudyInsightsRequest {
  attempts: RecentAttemptDetail[];
  language?: 'zh' | 'en';
}

export interface StudyInsightsResult {
  summary: string;
  highlights: string[];
  risks: string[];
  actions: string[];
}

export type {
  IdentifyQuestionsResult,
  IdentifyQualityReport,
  MarkdownPrecheckReport,
  QuestionIssue,
  QuestionIssueSeverity,
} from './question-diagnostics.js';
