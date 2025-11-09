import { Component, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './index.css';
import { SupabaseProvider } from './lib/supabaseClient';

function enforceIframeSandboxPolicy() {
  if (typeof document === 'undefined') return;

  const sanitizeIframe = (iframe: HTMLIFrameElement) => {
    const sandbox = iframe.getAttribute('sandbox');
    if (!sandbox) return;

    const tokens = sandbox
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean);

    const hasAllowScripts = tokens.includes('allow-scripts');
    const hasAllowSameOrigin = tokens.includes('allow-same-origin');

    if (!hasAllowScripts || !hasAllowSameOrigin) return;

    // Sécurité iframe : on retire allow-same-origin lorsqu'allow-scripts est présent
    // pour empêcher l'évasion du sandbox. Les scripts restent autorisés mais l'iframe
    // n'a plus un accès direct de type same-origin et doit utiliser postMessage.
    const filteredTokens = tokens.filter(token => token !== 'allow-same-origin');
    iframe.setAttribute('sandbox', filteredTokens.join(' '));
  };

  const scanNode = (root: ParentNode) => {
    if ('querySelectorAll' in root) {
      root.querySelectorAll('iframe[sandbox]').forEach(node => {
        if (node instanceof HTMLIFrameElement) {
          sanitizeIframe(node);
        }
      });
    }
  };

  scanNode(document);

  if (typeof MutationObserver === 'undefined') return;

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLIFrameElement) {
            sanitizeIframe(node);
          } else if (node instanceof Element) {
            scanNode(node);
          }
        });
      }

      if (mutation.type === 'attributes' && mutation.target instanceof HTMLIFrameElement) {
        sanitizeIframe(mutation.target);
      }
    });
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['sandbox'],
  });
}

enforceIframeSandboxPolicy();

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
    <SupabaseProvider>
      <ErrorBoundary>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </SupabaseProvider>
  </StrictMode>,
);
