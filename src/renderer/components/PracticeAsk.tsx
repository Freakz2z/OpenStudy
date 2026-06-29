import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Send, Sparkles } from 'lucide-react';
import type {
  PracticeAskRequest,
  Question,
  StudyChatMessage,
} from '@shared/types';
import { getChoiceOptionText } from '@shared/question-format';
import { MarkdownContent } from './MarkdownContent';
import {
  getPracticeChatSession,
  getPracticeChatSessionKey,
  upsertPracticeChatSession,
} from '../utils/practice-chat';

interface ReviewState {
  userAnswer: string;
  isCorrect: boolean;
}

interface Props {
  docId: number;
  open: boolean;
  question: Question;
  review?: ReviewState | null;
}

export function PracticeAsk({ docId, open, question, review }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [sessions, setSessions] = useState<Record<string, StudyChatMessage[]>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busyQuestionId, setBusyQuestionId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const sessionKey = getPracticeChatSessionKey(docId, question.id);

  const messages = sessions[sessionKey] ?? [];
  const error = errors[sessionKey];
  const busy = busyQuestionId === question.id;

  useEffect(() => {
    if (sessions[sessionKey] !== undefined) return;
    const stored = getPracticeChatSession(docId, question.id);
    setSessions((current) => ({
      ...current,
      [sessionKey]: stored?.messages ?? [],
    }));
  }, [docId, question.id, sessionKey, sessions]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, question.id]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight || '22') || 22;
    const paddingTop = Number.parseFloat(styles.paddingTop || '0') || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom || '0') || 0;
    const maxHeight = Math.round(lineHeight * 3 + paddingTop + paddingBottom);
    textarea.style.height = '0px';
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${Math.max(nextHeight, 56)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    if (composerRef.current) {
      composerRef.current.dataset.expanded = nextHeight > Math.ceil(lineHeight + paddingTop + paddingBottom + 2)
        ? 'true'
        : 'false';
    }
  }, [draft, open, question.id]);

  async function submitAsk(nextPrompt?: string) {
    const prompt = (nextPrompt ?? draft).trim();
    if (!prompt || busy) return;

    const history = messages;
    const nextUserMessage: StudyChatMessage = { role: 'user', content: prompt };
    const nextHistory = [...history, nextUserMessage];

    setSessions((cur) => ({
      ...cur,
      [sessionKey]: nextHistory,
    }));
    setErrors((cur) => ({ ...cur, [sessionKey]: null }));
    upsertPracticeChatSession(docId, question, nextHistory);
    setDraft('');
    setBusyQuestionId(question.id);

    try {
      const payload: PracticeAskRequest = {
        question: {
          type: question.type,
          stem: question.stem,
          options: question.options?.map(getChoiceOptionText) ?? null,
          answer: question.answer,
          explanation: question.explanation,
        },
        prompt,
        history,
        userAnswer: review?.userAnswer ?? null,
        isCorrect: review?.isCorrect ?? null,
      };
      const answer = await window.api.askPracticeQuestion(payload);
      setSessions((cur) => {
        const storedMessages = [
          ...(cur[sessionKey] ?? nextHistory),
          { role: 'assistant', content: answer } as StudyChatMessage,
        ];
        upsertPracticeChatSession(docId, question, storedMessages);
        return {
          ...cur,
          [sessionKey]: storedMessages,
        };
      });
    } catch (e) {
      setErrors((cur) => ({
        ...cur,
        [sessionKey]: (e as Error).message,
      }));
    } finally {
      setBusyQuestionId((cur) => (cur === question.id ? null : cur));
    }
  }

  if (!open) return null;

  return (
    <aside
      className="practice-ai-drawer"
      role="complementary"
      aria-label={t('practice.ask.title')}
    >
      <div className="practice-ai-body">
        <div className="practice-ai-thread" role="log" aria-live="polite">
          {messages.length === 0 && !busy && (
            <div className="practice-ai-empty-state">
              <Sparkles size={15} />
              <span>{t('practice.ask.placeholder')}</span>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`practice-ai-message ${message.role}`}
            >
              <div className="practice-ai-bubble">
                <MarkdownContent content={message.content} />
              </div>
            </div>
          ))}

          {busy && (
            <div className="practice-ai-message assistant">
              <div className="practice-ai-bubble">
                <span className="practice-ai-status">
                  <Loader2 size={12} className="spin" />
                  {t('practice.ask.thinking')}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="practice-ai-error" role="alert">
            {error}
          </div>
        )}
      </div>

      <div className="practice-ai-composer" ref={composerRef}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              void submitAsk();
            }
          }}
          placeholder={t('practice.ask.placeholder')}
          disabled={busy}
          rows={1}
        />
        <button
          className="primary sm practice-ai-send"
          onClick={() => void submitAsk()}
          disabled={busy || !draft.trim()}
          aria-label={t('practice.ask.ask')}
          title={t('practice.ask.ask')}
        >
          {busy ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
        </button>
      </div>
    </aside>
  );
}
