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
