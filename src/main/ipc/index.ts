import { registerAppIpc } from './app.ipc.js';
import { registerDocumentIpc } from './document.ipc.js';
import { registerQuestionIpc } from './question.ipc.js';
import { registerAttemptIpc } from './attempt.ipc.js';
import { registerSettingsIpc } from './settings.ipc.js';
import { registerLlmIpc } from './llm.ipc.js';

export function registerIpcHandlers(): void {
  registerAppIpc();
  registerDocumentIpc();
  registerQuestionIpc();
  registerAttemptIpc();
  registerSettingsIpc();
  registerLlmIpc();
}
