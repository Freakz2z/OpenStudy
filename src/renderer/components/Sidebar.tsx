import { useEffect, useMemo, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  FileText,
  Info,
  MessageSquare,
  ScrollText,
  Sparkles,
  Settings as SettingsIcon,
} from 'lucide-react';

export default function Sidebar() {
  const { t } = useTranslation();
  const [sidebarWidth, setSidebarWidth] = useState(240);

  const primaryNav = useMemo(() => ([
    { to: '/overview', icon: BarChart3, label: t('nav.overview') },
    { to: '/insights', icon: Sparkles, label: t('nav.insights') },
    { to: '/library', icon: BookOpen, label: t('nav.library') },
    { to: '/wrong', icon: AlertCircle, label: t('nav.wrongbook') },
    { to: '/conversations', icon: MessageSquare, label: t('nav.conversations') },
    { to: '/logs', icon: ScrollText, label: t('nav.logs') },
  ]), [t]);

  const secondaryNav = useMemo(() => ([
    { to: '/templates', icon: FileText, label: t('nav.templates') },
  ]), [t]);

  function applySidebarWidth(nextWidth: number) {
    const width = Math.min(360, Math.max(200, nextWidth));
    setSidebarWidth(width);
    document.documentElement.style.setProperty('--sidebar-w', `${width}px`);
    window.localStorage.setItem('openstudy:sidebar-width', String(width));
  }

  useEffect(() => {
    const stored = Number(window.localStorage.getItem('openstudy:sidebar-width'));
    if (Number.isFinite(stored) && stored > 0) {
      applySidebarWidth(stored);
    } else {
      document.documentElement.style.setProperty('--sidebar-w', `${sidebarWidth}px`);
    }
    return () => {
    };
  }, []);

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (moveEvent: PointerEvent) => {
      applySidebarWidth(startWidth + (moveEvent.clientX - startX));
    };

    const cleanup = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  }

  function onResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      applySidebarWidth(sidebarWidth - 16);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      applySidebarWidth(sidebarWidth + 16);
    }
  }

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav sidebar-nav-primary" aria-label={t('nav.primary')}>
        {primaryNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <nav className="sidebar-nav sidebar-nav-secondary" aria-label={t('nav.secondary')}>
        {secondaryNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-utility">
        <div className="sidebar-utility-surface">
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <SettingsIcon size={16} />
            <span>{t('nav.settings')}</span>
          </NavLink>
        </div>

        <NavLink
          to="/about"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          <Info size={16} />
          <span>{t('nav.about')}</span>
        </NavLink>
      </div>
      <div
        className="sidebar-resize-handle"
        role="separator"
        aria-label={t('nav.resizeSidebar')}
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={onResizePointerDown}
        onKeyDown={onResizeKeyDown}
      />
    </aside>
  );
}
