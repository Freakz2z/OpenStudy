import { useLayoutEffect } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { GlobalTooltip } from './components/GlobalTooltip';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import Insights from './pages/Insights';
import Library from './pages/Library';
import Practice from './pages/Practice';
import Exam from './pages/Exam';
import WrongBook from './pages/WrongBook';
import Conversations from './pages/Conversations';
import Settings from './pages/Settings';
import About from './pages/About';
import Records from './pages/Records';
import CreateDocument from './pages/CreateDocument';
import MarkdownEditor from './pages/MarkdownEditor';
import Templates from './pages/Templates';
import Skills from './pages/Skills';

function RouteEffects() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    document.getElementById('app-main')?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <div className="app">
      <GlobalTooltip />
      <Sidebar />
      <main className="main" id="app-main">
        <RouteEffects />
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/create" element={<CreateDocument />} />
          <Route path="/practice/:docId" element={<Practice />} />
          <Route path="/exam/:docId" element={<Exam />} />
          <Route path="/records/:docId" element={<Records />} />
          <Route path="/wrong/:docId" element={<WrongBook />} />
          <Route path="/conversations/:docId" element={<Conversations />} />
          <Route path="/markdown/:docId" element={<MarkdownEditor />} />
          <Route path="/models" element={<Navigate to="/settings" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </main>
    </div>
  );
}
