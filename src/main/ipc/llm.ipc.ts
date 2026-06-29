import { ipcMain } from 'electron';
import type {
  ModelTestRequest,
  PracticeAskRequest,
  PracticeGradeRequest,
  StudyInsightsRequest,
} from '../../shared/types.js';
import {
  askPracticeQuestion,
  generateStudyInsights,
  gradePracticeAnswer,
  testModelConnection,
} from '../services/llm/index.js';

export function registerLlmIpc(): void {
  ipcMain.handle('llm:practiceAsk', (_e, payload: PracticeAskRequest) =>
    askPracticeQuestion(payload),
  );
  ipcMain.handle('llm:practiceGrade', (_e, payload: PracticeGradeRequest) =>
    gradePracticeAnswer(payload),
  );
  ipcMain.handle('llm:testModel', (_e, payload: ModelTestRequest) =>
    testModelConnection(payload),
  );
  ipcMain.handle('llm:studyInsights', (_e, payload: StudyInsightsRequest) =>
    generateStudyInsights(payload),
  );
}
