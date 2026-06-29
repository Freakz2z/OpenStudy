import React from 'react';

interface State {
  err: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', err, info);
  }

  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, color: '#dc2626', fontFamily: 'monospace' }}>
          <h2>页面出错了</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.err.stack ?? this.state.err.message}</pre>
          <button
            style={{ marginTop: 12, padding: '6px 12px' }}
            onClick={() => location.reload()}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
