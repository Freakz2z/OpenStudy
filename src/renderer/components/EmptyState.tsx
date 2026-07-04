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
    <div className={`card empty-state${compact ? ' compact' : ''}`}>
      <Icon
        size={compact ? 28 : 36}
        className="empty-state-icon"
        aria-hidden="true"
      />
      <div className={`empty-state-title${description ? ' has-desc' : ''}`}>
        {title}
      </div>
      {description && (
        <div className="muted empty-state-desc">
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
