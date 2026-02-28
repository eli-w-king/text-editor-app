import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Pricing from './pages/Pricing';
import DocumentListPage from './pages/DocumentListPage';
import EditorPage from './pages/EditorPage';
import OnboardingPage from './pages/OnboardingPage';

// ---------------------------------------------------------------------------
//  Route Guards
// ---------------------------------------------------------------------------

/**
 * GuestOnly -- renders children only when user is NOT authenticated.
 * Redirects authenticated users to home.
 */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * RequireAuth -- renders children only when user IS authenticated.
 * Redirects unauthenticated users to login.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
//  Home Page (landing / dashboard)
// ---------------------------------------------------------------------------

function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) return null;

  // If authenticated, redirect to documents
  if (isAuthenticated) {
    return <Navigate to="/documents" replace />;
  }

  // Unauthenticated landing -- offer quick access to the editor
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
      background: 'linear-gradient(145deg, #0c0c0e 0%, #111118 30%, #0e1117 60%, #0a0a10 100%)',
      fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{
        padding: 48,
        borderRadius: 28,
        background: 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(48px) saturate(160%)',
        WebkitBackdropFilter: 'blur(48px) saturate(160%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        textAlign: 'center' as const,
        maxWidth: 440,
      }}>
        <h1 style={{
          color: '#ECEDEE',
          fontFamily: "'Lora', Georgia, serif",
          fontWeight: 400,
          fontSize: 42,
          letterSpacing: '-0.5px',
          marginBottom: 8,
        }}>
          Inlay
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 15,
          lineHeight: 1.6,
          marginBottom: 36,
          fontWeight: 300,
        }}>
          A premium writing environment. Start writing immediately -- no account required.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => navigate('/editor/local')}
            style={{
              padding: '14px 28px',
              borderRadius: 14,
              border: 'none',
              background: 'rgba(255,255,255,0.95)',
              color: '#0a0a0a',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              letterSpacing: '-0.1px',
            }}
          >
            Open Editor
          </button>

          <div style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
          }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#ECEDEE',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: 'all 0.25s ease',
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#ECEDEE',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: 'all 0.25s ease',
              }}
            >
              Create Account
            </button>
          </div>
        </div>
      </div>

      <p style={{
        color: 'rgba(255,255,255,0.2)',
        fontSize: 12,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        Cloud sync available with a free account
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Local Editor Page -- works without authentication
//
//  A self-contained editor that saves to localStorage. This lets users
//  start writing immediately without needing an account or a backend.
// ---------------------------------------------------------------------------

function LocalEditorPage() {
  const STORAGE_KEY = 'inlay-local-document';
  const [title, setTitle] = React.useState(() => {
    try { return localStorage.getItem(STORAGE_KEY + '-title') || ''; } catch { return ''; }
  });
  const [body, setBody] = React.useState(() => {
    try { return localStorage.getItem(STORAGE_KEY + '-body') || ''; } catch { return ''; }
  });
  const [wordCount, setWordCount] = React.useState(0);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  // Dark mode detection
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem('writer-theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch { /* ignore */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem('writer-theme');
        if (!stored) setIsDark(e.matches);
      } catch { /* ignore */ }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const p = isDark
    ? {
        bg: 'linear-gradient(145deg, #0c0c0e 0%, #111118 30%, #0e1117 60%, #0a0a10 100%)',
        text: '#ECEDEE',
        textMuted: 'rgba(236, 237, 238, 0.5)',
        textDim: 'rgba(236, 237, 238, 0.25)',
      }
    : {
        bg: 'linear-gradient(145deg, #f5f5f7 0%, #eeeef0 30%, #e8e8ed 60%, #f0f0f2 100%)',
        text: '#1C1C1E',
        textMuted: 'rgba(28, 28, 30, 0.5)',
        textDim: 'rgba(28, 28, 30, 0.25)',
      };

  // Auto-save to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '-title', title);
      localStorage.setItem(STORAGE_KEY + '-body', body);
    } catch { /* storage full or unavailable */ }
  }, [title, body]);

  // Word count
  React.useEffect(() => {
    const words = body.trim() ? body.trim().split(/\s+/).length : 0;
    setWordCount(words);
  }, [body]);

  // Auto-resize textarea
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  return (
    <div style={{
      minHeight: '100vh',
      background: p.bg,
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: p.text,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Navigation */}
      <nav style={{
        width: '100%',
        maxWidth: 760,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky' as const,
        top: 0,
        zIndex: 10,
        backdropFilter: 'blur(32px) saturate(140%)',
        WebkitBackdropFilter: 'blur(32px) saturate(140%)',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            color: p.textMuted,
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: "'Inter', system-ui, sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 0',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Home
        </button>
        <span style={{ fontSize: 12, color: p.textDim }}>
          Saving locally
        </span>
      </nav>

      {/* Editor area */}
      <div style={{
        width: '100%',
        maxWidth: 760,
        padding: '0 24px 80px',
        flex: 1,
      }}>
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocusedField('title')}
          onBlur={() => setFocusedField(null)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: p.text,
            fontFamily: "'Lora', Georgia, serif",
            fontSize: 36,
            fontWeight: 400,
            letterSpacing: '-0.3px',
            lineHeight: 1.2,
            padding: '24px 0 12px',
            boxSizing: 'border-box' as const,
            transition: 'opacity 0.2s ease',
            opacity: focusedField === 'title' ? 1 : 0.9,
          }}
          placeholder="Untitled"
          aria-label="Document title"
        />

        {/* Separator */}
        <div style={{
          width: 40,
          height: 1,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          margin: '4px 0 12px',
        }} />

        {/* Body */}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setFocusedField('body')}
          onBlur={() => setFocusedField(null)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: p.text,
            fontFamily: "'Lora', Georgia, serif",
            fontSize: 18,
            fontWeight: 400,
            lineHeight: '28px',
            padding: '8px 0',
            resize: 'none' as const,
            minHeight: 400,
            boxSizing: 'border-box' as const,
            overflow: 'hidden',
          }}
          placeholder="Start writing..."
          aria-label="Document body"
        />
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed' as const,
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 24px',
        textAlign: 'center' as const,
        fontSize: 11,
        color: p.textDim,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  App
// ---------------------------------------------------------------------------

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Local editor -- no auth required */}
          <Route path="/editor/local" element={<LocalEditorPage />} />

          {/* Auth pages -- only for guests */}
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

          {/* Authenticated routes */}
          <Route path="/documents" element={<RequireAuth><DocumentListPage /></RequireAuth>} />
          <Route path="/editor/:documentId" element={<RequireAuth><EditorPage /></RequireAuth>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// ---------------------------------------------------------------------------
//  Mount
// ---------------------------------------------------------------------------

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
