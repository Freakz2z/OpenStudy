import { contextBridge, ipcRenderer } from 'electron';
import type {
  Document,
  DocumentStats,
  IdentifyLogEntry,
  IdentifyQuestionsResult,
  PracticeAskRequest,
  PracticeGradeRequest,
  PracticeGradeResult,
  ModelTestRequest,
  ModelTestResult,
  OverallStats,
  QuestionAttemptSnapshot,
  RecentAttemptDetail,
  Question,
  QuestionUpdate,
  StudyInsightsRequest,
  StudyInsightsResult,
  WrongQuestion,
} from '../shared/types.js';
import type { MarkdownStandardLanguage } from '../shared/markdown-standard.js';

export interface IdentifyProgress {
  docId: number;
  phase: 'parse' | 'llm' | 'merge' | 'done';
  message: string;
  current?: number;
  total?: number;
}

const api = {
  ping: () => ipcRenderer.invoke('app:ping'),
  importFile: () => ipcRenderer.invoke('document:import'),
  listDocuments: (): Promise<Document[]> => ipcRenderer.invoke('document:list'),
  deleteDocument: (id: number) => ipcRenderer.invoke('document:delete', id),
  identifyQuestions: (
    docId: number,
    lang?: MarkdownStandardLanguage,
  ): Promise<Question[] | IdentifyQuestionsResult> =>
    ipcRenderer.invoke('question:identify', docId, lang),
  listIdentifyLogs: (docId?: number, limit?: number): Promise<IdentifyLogEntry[]> =>
    ipcRenderer.invoke('question:listIdentifyLogs', docId, limit),
  deleteIdentifyLog: (id: string): Promise<void> =>
    ipcRenderer.invoke('question:deleteIdentifyLog', id),
  clearIdentifyLogs: (): Promise<void> =>
    ipcRenderer.invoke('question:clearIdentifyLogs'),
  onIdentifyProgress: (cb: (p: IdentifyProgress) => void) => {
    const listener = (_e: unknown, p: IdentifyProgress) => cb(p);
    ipcRenderer.on('question:identify:progress', listener);
    return () => {
      ipcRenderer.removeListener('question:identify:progress', listener);
    };
  },
  getQuestionsByDocument: (docId: number): Promise<Question[]> =>
    ipcRenderer.invoke('question:list', docId),
  updateQuestion: (qId: number, patch: QuestionUpdate) =>
    ipcRenderer.invoke('question:update', qId, patch),
  getMarkdown: (
    docId: number,
    lang?: MarkdownStandardLanguage,
  ): Promise<{ markdown: string; source: 'db' | 'fresh' }> =>
    ipcRenderer.invoke('question:getMarkdown', docId, lang),
  saveMarkdown: (docId: number, markdown: string) =>
    ipcRenderer.invoke('question:saveMarkdown', docId, markdown),
  parseExam: (markdown: string, lang?: MarkdownStandardLanguage) =>
    ipcRenderer.invoke('exam:parse', markdown, lang),
  importExam: (docId: number, markdown: string, lang?: MarkdownStandardLanguage) =>
    ipcRenderer.invoke('exam:importToDb', docId, markdown, lang),
  saveAttempt: (qId: number, userAnswer: string, isCorrect: boolean) =>
    ipcRenderer.invoke('attempt:save', qId, userAnswer, isCorrect),
  listWrongQuestions: (): Promise<WrongQuestion[]> =>
    ipcRenderer.invoke('attempt:listWrong'),
  listAttemptsByDocument: (docId: number): Promise<QuestionAttemptSnapshot[]> =>
    ipcRenderer.invoke('attempt:listByDocument', docId),
  listRecentAttempts: (limit?: number): Promise<RecentAttemptDetail[]> =>
    ipcRenderer.invoke('attempt:listRecent', limit),
  removeWrongQuestion: (qId: number) => ipcRenderer.invoke('attempt:removeWrong', qId),
  clearWrongBook: () => ipcRenderer.invoke('attempt:clearAll'),
  resetDocumentProgress: (docId: number) =>
    ipcRenderer.invoke('attempt:clearDocument', docId),
  getDocumentStats: (docId: number): Promise<DocumentStats> =>
    ipcRenderer.invoke('stats:document', docId),
  getOverallStats: (): Promise<OverallStats> => ipcRenderer.invoke('stats:overall'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: unknown) => ipcRenderer.invoke('settings:update', settings),
  askPracticeQuestion: (payload: PracticeAskRequest): Promise<string> =>
    ipcRenderer.invoke('llm:practiceAsk', payload),
  gradePracticeAnswer: (payload: PracticeGradeRequest): Promise<PracticeGradeResult> =>
    ipcRenderer.invoke('llm:practiceGrade', payload),
  testModel: (payload: ModelTestRequest): Promise<ModelTestResult> =>
    ipcRenderer.invoke('llm:testModel', payload),
  generateStudyInsights: (payload: StudyInsightsRequest): Promise<StudyInsightsResult> =>
    ipcRenderer.invoke('llm:studyInsights', payload),
};

contextBridge.exposeInMainWorld('api', api);

export type OpenStudyAPI = typeof api;
