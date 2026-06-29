import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { label: string; onClick: () => void };
}

/**
 * 一级页面统一页头：标题区、可选说明和右侧操作使用同一套布局与分隔线。
 */
export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <header className="page-header">
      {back && (
        <button
          className="icon-only ghost page-header-back"
          onClick={back.onClick}
          aria-label={back.label}
          title={back.label}
        >
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="page-header-copy">
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
