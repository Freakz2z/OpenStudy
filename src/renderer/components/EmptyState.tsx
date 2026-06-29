import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loadingLabel?: string;
  };
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className="card"
      style={{
        textAlign: 'center',
        padding: compact ? '20px 16px' : '40px 24px',
      }}
    >
      <Icon
        size={compact ? 28 : 36}
        style={{ opacity: 0.4, marginBottom: 8 }}
        aria-hidden="true"
      />
      <div style={{ fontWeight: 500, marginBottom: description ? 4 : 12 }}>
        {title}
      </div>
      {description && (
        <div className="muted" style={{ marginBottom: 12 }}>
          {description}
        </div>
      )}
      {action && (
        <button
          className="primary"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.disabled && <Loader2 size={16} className="spin" />}
          {action.disabled && action.loadingLabel
            ? action.loadingLabel
            : action.label}
        </button>
      )}
    </div>
  );
}
