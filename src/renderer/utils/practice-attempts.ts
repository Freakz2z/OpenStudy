const PRACTICE_ATTEMPT_STORAGE_PREFIX = 'openstudy:practice';

export interface StoredAttemptRecord {
  questionId: number;
  userAnswer: string;
  isCorrect: boolean;
  feedback?: string | null;
  attemptedAt: number;
}

export function practiceStorageKey(docId: number): string {
  return `${PRACTICE_ATTEMPT_STORAGE_PREFIX}:${docId}:attempts`;
}

export function loadStoredAttempts(docId: number): StoredAttemptRecord[] {
  try {
    const raw = window.localStorage.getItem(practiceStorageKey(docId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.reduce<StoredAttemptRecord[]>((acc, item) => {
      const value = item as Partial<StoredAttemptRecord>;
      if (
        typeof value.questionId !== 'number' ||
        typeof value.userAnswer !== 'string' ||
        typeof value.isCorrect !== 'boolean'
      ) {
        return acc;
      }
      acc.push({
        questionId: value.questionId,
        userAnswer: value.userAnswer,
        isCorrect: value.isCorrect,
        feedback:
          typeof value.feedback === 'string' || value.feedback === null
            ? value.feedback
            : null,
        attemptedAt:
          typeof value.attemptedAt === 'number' && Number.isFinite(value.attemptedAt)
            ? value.attemptedAt
            : 0,
      });
      return acc;
    }, []);
  } catch {
    return [];
  }
}

export function saveStoredAttempts(
  docId: number,
  attempts: Array<{
    question: { id: number };
    userAnswer: string;
    isCorrect: boolean;
    feedback?: string | null;
    attemptedAt?: number;
  }>,
): void {
  try {
    const payload: StoredAttemptRecord[] = attempts.map((attempt) => ({
      questionId: attempt.question.id,
      userAnswer: attempt.userAnswer,
      isCorrect: attempt.isCorrect,
      feedback: attempt.feedback ?? null,
      attemptedAt: attempt.attemptedAt ?? Date.now(),
    }));
    window.localStorage.setItem(practiceStorageKey(docId), JSON.stringify(payload));
  } catch {
    // ignore local persistence errors
  }
}

export function clearStoredAttempts(docId: number): void {
  try {
    window.localStorage.removeItem(practiceStorageKey(docId));
  } catch {
    // ignore local persistence errors
  }
}

/* ---- Exam state helpers ---- */

const EXAM_STORAGE_PREFIX = 'openstudy:exam';

function examAnswersKey(docId: number): string {
  return `${EXAM_STORAGE_PREFIX}:${docId}:answers`;
}

function examStartTimeKey(docId: number): string {
  return `${EXAM_STORAGE_PREFIX}:${docId}:startTime`;
}

export function loadExamAnswers(docId: number): Record<number, string> {
  try {
    const raw = window.localStorage.getItem(examAnswersKey(docId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return {};
    const map: Record<number, string> = {};
    for (const item of parsed) {
      const entry = item as { questionId?: number; userAnswer?: string };
      if (typeof entry.questionId === 'number' && typeof entry.userAnswer === 'string' && entry.userAnswer.trim()) {
        map[entry.questionId] = entry.userAnswer;
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function saveExamAnswers(docId: number, answers: Record<number, string>): void {
  try {
    const payload = Object.entries(answers)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => ({ questionId: Number(k), userAnswer: v }));
    window.localStorage.setItem(examAnswersKey(docId), JSON.stringify(payload));
  } catch {
    // ignore local persistence errors
  }
}

export function loadExamStartTime(docId: number): number | null {
  try {
    const raw = window.localStorage.getItem(examStartTimeKey(docId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveExamStartTime(docId: number, startTime: number): void {
  try {
    window.localStorage.setItem(examStartTimeKey(docId), String(startTime));
  } catch {
    // ignore local persistence errors
  }
}

export function clearExamState(docId: number): void {
  try {
    window.localStorage.removeItem(examAnswersKey(docId));
    window.localStorage.removeItem(examStartTimeKey(docId));
  } catch {
    // ignore local persistence errors
  }
}
