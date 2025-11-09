import { Component, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './index.css';

if (import.meta.env.DEV) {
  console.info('[ENV]', {
    hasUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
    hasAnon: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
    hasPubl: Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  });
}

type ErrorBoundaryState = { error?: Error };

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: undefined };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Runtime error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('Error type:', error.name, 'Message:', error.message);
  }

  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 16, color: 'crimson', whiteSpace: 'pre-wrap' }}>
          {String(this.state.error.message ?? this.state.error)}
        </pre>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
