import { createContext, useCallback, useContext, useState, useRef, type ReactNode } from 'react';
import { Toast, type ToastData, type ToastKind } from './Toast';

interface ToastContextValue {
  show: (kind: ToastKind, message: string, opts?: Partial<Omit<ToastData, 'id' | 'kind' | 'message'>>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const idRef = useRef(0);

  const show = useCallback<ToastContextValue['show']>((kind, message, opts) => {
    idRef.current += 1;
    const id = `t${idRef.current}`;
    setToasts((prev) => [...prev, { id, kind, message, ...opts }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="toast-container"
          role="region"
          aria-label="Notifications"
        >
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
