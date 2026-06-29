import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { PreferencesProvider } from './contexts/PreferencesProvider';
import { applyTheme, readPrefs } from './preferences';
import './i18n';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

// 首次绘制前应用主题，避免启动时短暂闪烁为错误主题。
applyTheme(readPrefs().theme);

// eslint-disable-next-line no-console
console.log('[boot] window.api =', (window as unknown as { api?: unknown }).api);

createRoot(container).render(
  <ErrorBoundary>
    <PreferencesProvider>
      <ToastProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ToastProvider>
    </PreferencesProvider>
  </ErrorBoundary>,
);
