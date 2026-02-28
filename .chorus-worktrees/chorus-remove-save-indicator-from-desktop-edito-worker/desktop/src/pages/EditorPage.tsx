/**
 * EditorPage -- Main document editing page (placeholder).
 *
 * PLATFORM: Web (Desktop/Browser)
 * AESTHETIC: visionOS-inspired frosted glass, premium, minimal
 *
 * Provides a centered content area for editing text. The actual rich text
 * editor integration (e.g. TipTap, ProseMirror) will replace the textarea
 * in a future iteration. For now, this is a functional placeholder that
 * loads/saves document content from the document-sync API.
 *
 * Saving follows the "it just works" philosophy -- autosave runs silently
 * in the background with no visible indicator. If a save fails, the next
 * change will trigger a retry via the debounce timer.
 *
 * Route: /editor/:documentId
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getToken } from '../services/auth';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

interface Document {
  document_id: string;
  title: string;
  content?: {
    plainText?: string;
    ops?: unknown[];
  };
  version?: number;
  updated_at: string;
}

// ---------------------------------------------------------------------------
//  Theme
// ---------------------------------------------------------------------------

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem('writer-theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch { /* ignore */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem('writer-theme');
        if (!stored) setDark(e.matches);
      } catch { /* ignore */ }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return dark;
}

interface ThemePalette {
  bg: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  text: string;
  textMuted: string;
  textDim: string;
  inputBg: string;
  dangerBg: string;
  dangerText: string;
}

function getPalette(dark: boolean): ThemePalette {
  if (dark) {
    return {
      bg: 'linear-gradient(145deg, #0c0c0e 0%, #111118 30%, #0e1117 60%, #0a0a10 100%)',
      cardBg: 'rgba(255, 255, 255, 0.04)',
      cardBorder: '1px solid rgba(255, 255, 255, 0.06)',
      cardShadow: '0 8px 40px rgba(0,0,0,0.3)',
      text: '#ECEDEE',
      textMuted: 'rgba(236, 237, 238, 0.5)',
      textDim: 'rgba(236, 237, 238, 0.25)',
      inputBg: 'transparent',
      dangerBg: 'rgba(255, 59, 48, 0.1)',
      dangerText: '#FF6B6B',
    };
  }
  return {
    bg: 'linear-gradient(145deg, #f5f5f7 0%, #eeeef0 30%, #e8e8ed 60%, #f0f0f2 100%)',
    cardBg: 'rgba(255, 255, 255, 0.8)',
    cardBorder: '1px solid rgba(0, 0, 0, 0.05)',
    cardShadow: '0 4px 24px rgba(0,0,0,0.05)',
    text: '#1C1C1E',
    textMuted: 'rgba(28, 28, 30, 0.5)',
    textDim: 'rgba(28, 28, 30, 0.25)',
    inputBg: 'transparent',
    dangerBg: 'rgba(255, 59, 48, 0.06)',
    dangerText: '#FF3B30',
  };
}

// ---------------------------------------------------------------------------
//  API
// ---------------------------------------------------------------------------

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SYNC_API_URL) ||
  'https://writer-app-document-sync.inlaynoteapp.workers.dev';

async function fetchDocument(token: string, id: string): Promise<Document> {
  const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load document');
  return (await res.json()) as Document;
}

async function saveDocument(
  token: string,
  id: string,
  title: string,
  plainText: string,
  version?: number,
): Promise<Document> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (version != null) headers['X-Document-Version'] = String(version);

  const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      title,
      content: { plainText, ops: [{ insert: plainText }] },
    }),
  });
  if (!res.ok) throw new Error('Failed to save');
  return (await res.json()) as Document;
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

export default function EditorPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();

  const isDark = usePrefersDark();
  const p = useMemo(() => getPalette(isDark), [isDark]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const versionRef = useRef<number | undefined>(undefined);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ---- Load document ----
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (!documentId) {
      navigate('/documents', { replace: true });
      return;
    }

    let cancelled = false;
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const doc = await fetchDocument(token, documentId);
        if (cancelled) return;
        setTitle(doc.title || '');
        setBody(doc.content?.plainText || '');
        versionRef.current = doc.version;
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load document');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, documentId, navigate]);

  // ---- Word count ----
  useEffect(() => {
    const words = body.trim() ? body.trim().split(/\s+/).length : 0;
    setWordCount(words);
  }, [body]);

  // ---- Silent auto-save (debounced 2.5 seconds) ----
  // Follows the "it just works" philosophy: saving happens silently in the
  // background with no visible status. If a save fails, the next content
  // change will trigger a retry via the debounce timer.
  const doSave = useCallback(async () => {
    if (!documentId) return;
    const token = getToken();
    if (!token) return;

    try {
      const updated = await saveDocument(token, documentId, title, body, versionRef.current);
      versionRef.current = updated.version;
    } catch {
      // Silent failure -- the next content change will retry via the
      // debounce timer, so no user-facing error is needed here.
    }
  }, [documentId, title, body]);

  useEffect(() => {
    if (loading) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      doSave();
    }, 2500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [title, body, doSave, loading]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doSave]);

  // ---- Auto-resize textarea ----
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  // ---- Auth guard ----
  if (authLoading) return null;
  if (!isAuthenticated) return null;

  // =====================================================================
  //  Styles
  // =====================================================================

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: p.bg,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: p.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const navStyle: React.CSSProperties = {
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
  };

  const backButtonStyle: React.CSSProperties = {
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
    transition: 'color 0.2s ease',
  };

  const editorAreaStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 760,
    padding: '0 24px 80px',
    flex: 1,
  };

  const titleInputStyle: React.CSSProperties = {
    width: '100%',
    background: p.inputBg,
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
  };

  const bodyTextareaStyle: React.CSSProperties = {
    width: '100%',
    background: p.inputBg,
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
  };

  const footerStyle: React.CSSProperties = {
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
  };

  // =====================================================================
  //  Render
  // =====================================================================

  if (loading) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ color: p.textMuted, fontSize: 14 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <div style={{ color: p.dangerText, fontSize: 14 }}>{error}</div>
          <button
            onClick={() => navigate('/documents')}
            style={{
              ...backButtonStyle,
              color: p.text,
              padding: '10px 20px',
              borderRadius: 12,
              border: p.cardBorder,
              background: p.cardBg,
              backdropFilter: 'blur(24px)',
            }}
          >
            Back to Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Top navigation */}
      <nav style={navStyle}>
        <button onClick={() => navigate('/documents')} style={backButtonStyle}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Documents
        </button>
      </nav>

      {/* Editor area */}
      <div style={editorAreaStyle}>
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocusedField('title')}
          onBlur={() => setFocusedField(null)}
          style={titleInputStyle}
          placeholder="Untitled"
          aria-label="Document title"
        />

        {/* Separator */}
        <div
          style={{
            width: 40,
            height: 1,
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            margin: '4px 0 12px',
          }}
        />

        {/* Body -- using textarea as a placeholder for a future rich text editor */}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setFocusedField('body')}
          onBlur={() => setFocusedField(null)}
          style={bodyTextareaStyle}
          placeholder="Start writing..."
          aria-label="Document body"
        />
      </div>

      {/* Footer - word count */}
      <div style={footerStyle}>
        {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </div>
    </div>
  );
}
