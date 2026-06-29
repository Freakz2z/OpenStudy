import type { Question, QuestionType, StudyChatMessage } from '@shared/types';

const PRACTICE_CHAT_STORAGE_KEY = 'openstudy:practice-chat:v1';

export interface PracticeChatSession {
  key: string;
  docId: number;
  questionId: number;
  questionType: QuestionType;
  questionStem: string;
  updatedAt: number;
  messages: StudyChatMessage[];
}

function isStudyChatMessage(value: unknown): value is StudyChatMessage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StudyChatMessage>;
  return (
    (item.role === 'user' || item.role === 'assistant') &&
    typeof item.content === 'string'
  );
}

function isPracticeChatSession(value: unknown): value is PracticeChatSession {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PracticeChatSession>;
  return (
    typeof item.key === 'string' &&
    typeof item.docId === 'number' &&
    typeof item.questionId === 'number' &&
    typeof item.questionType === 'string' &&
    typeof item.questionStem === 'string' &&
    typeof item.updatedAt === 'number' &&
    Array.isArray(item.messages) &&
    item.messages.every(isStudyChatMessage)
  );
}

export function getPracticeChatSessionKey(docId: number, questionId: number): string {
  return `${docId}:${questionId}`;
}

function loadStore(): Record<string, PracticeChatSession> {
  try {
    const raw = window.localStorage.getItem(PRACTICE_CHAT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, PracticeChatSession>>(
      (acc, [key, value]) => {
        if (isPracticeChatSession(value)) acc[key] = value;
        return acc;
      },
      {},
    );
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, PracticeChatSession>): void {
  try {
    window.localStorage.setItem(PRACTICE_CHAT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore persistence errors
  }
}

export function getPracticeChatSession(
  docId: number,
  questionId: number,
): PracticeChatSession | null {
  const key = getPracticeChatSessionKey(docId, questionId);
  return loadStore()[key] ?? null;
}

export function upsertPracticeChatSession(
  docId: number,
  question: Pick<Question, 'id' | 'type' | 'stem'>,
  messages: StudyChatMessage[],
): PracticeChatSession | null {
  const key = getPracticeChatSessionKey(docId, question.id);
  const store = loadStore();

  if (messages.length === 0) {
    delete store[key];
    saveStore(store);
    return null;
  }

  const session: PracticeChatSession = {
    key,
    docId,
    questionId: question.id,
    questionType: question.type,
    questionStem: question.stem,
    updatedAt: Date.now(),
    messages,
  };
  store[key] = session;
  saveStore(store);
  return session;
}

export function listPracticeChatSessions(): PracticeChatSession[] {
  return Object.values(loadStore()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deletePracticeChatSession(docId: number, questionId: number): void {
  const key = getPracticeChatSessionKey(docId, questionId);
  const store = loadStore();
  delete store[key];
  saveStore(store);
}

export function clearPracticeChatSessionsByDocument(docId: number): void {
  const store = loadStore();
  const next = Object.fromEntries(
    Object.entries(store).filter(([, session]) => session.docId !== docId),
  );
  saveStore(next);
}

export function clearPracticeChatSessions(): void {
  try {
    window.localStorage.removeItem(PRACTICE_CHAT_STORAGE_KEY);
  } catch {
    // ignore persistence errors
  }
}
