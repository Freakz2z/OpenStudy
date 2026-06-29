import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastKind = 'success' | 'warning' | 'error' | 'info';

export interface ToastData {
  id: string;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const { t } = useTranslation();
  const Icon = ICONS[toast.kind];
  const duration = toast.duration ?? 3000;
  const role = toast.kind === 'error' || toast.kind === 'warning' ? 'alert' : 'status';
  const ariaLive = role === 'alert' ? 'assertive' : 'polite';

  useEffect(() => {
    if (duration <= 0) return;
    const t = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(t);
  }, [toast.id, duration, onDismiss]);

  function onMouseEnter() {
    // 简化：hover 不暂停（避免 setTimeout 管理复杂度）
  }

  return (
    <div
      className={`card toast toast-${toast.kind}`}
      role={role}
      aria-live={ariaLive}
      onMouseEnter={onMouseEnter}
    >
      <div className="row" style={{ width: '100%' }}>
        <Icon size={18} />
        <div style={{ flex: 1 }}>{toast.message}</div>
        {toast.action && (
          <button className="ghost" onClick={toast.action.onClick}>
            {toast.action.label}
          </button>
        )}
        <button
          className="icon-only ghost"
          onClick={() => onDismiss(toast.id)}
          aria-label={t('common.close')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
