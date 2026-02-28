/**
 * DocumentListPage -- Lists user documents with create/open actions.
 *
 * PLATFORM: Web (Desktop/Browser)
 * AESTHETIC: visionOS-inspired frosted glass, premium, minimal
 *
 * Displays a grid of document cards fetched from cloud sync,
 * with a prominent "New Document" action. Each card shows the
 * document title, a preview snippet, and the last-modified timestamp.
 *
 * Uses the auth context to verify the user is logged in, and the
 * auth token is sent with API requests to the document-sync worker.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  };
  metadata?: {
    wordCount?: number;
  };
  updated_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
//  Theme helpers
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
  accent: string;
  accentMuted: string;
  inputBg: string;
  inputBorder: string;
  dangerBg: string;
  dangerText: string;
  emptyIcon: string;
}

function getPalette(dark: boolean): ThemePalette {
  if (dark) {
    return {
      bg: 'linear-gradient(145deg, #0c0c0e 0%, #111118 30%, #0e1117 60%, #0a0a10 100%)',
      cardBg: 'rgba(255, 255, 255, 0.06)',
      cardBorder: '1px solid rgba(255, 255, 255, 0.08)',
      cardShadow: '0 8px 40px rgba(0,0,0,0.4), 0 2px 12px rgba(0,0,0,0.2)',
      text: '#ECEDEE',
      textMuted: 'rgba(236, 237, 238, 0.5)',
      textDim: 'rgba(236, 237, 238, 0.3)',
      accent: 'rgba(255, 255, 255, 0.95)',
      accentMuted: 'rgba(255, 255, 255, 0.08)',
      inputBg: 'rgba(255, 255, 255, 0.05)',
      inputBorder: 'rgba(255, 255, 255, 0.1)',
      dangerBg: 'rgba(255, 59, 48, 0.1)',
      dangerText: '#FF6B6B',
      emptyIcon: 'rgba(255, 255, 255, 0.06)',
    };
  }
  return {
    bg: 'linear-gradient(145deg, #f5f5f7 0%, #eeeef0 30%, #e8e8ed 60%, #f0f0f2 100%)',
    cardBg: 'rgba(255, 255, 255, 0.7)',
    cardBorder: '1px solid rgba(0, 0, 0, 0.06)',
    cardShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 6px rgba(0,0,0,0.04)',
    text: '#1C1C1E',
    textMuted: 'rgba(28, 28, 30, 0.5)',
    textDim: 'rgba(28, 28, 30, 0.3)',
    accent: '#1C1C1E',
    accentMuted: 'rgba(0, 0, 0, 0.04)',
    inputBg: 'rgba(0, 0, 0, 0.03)',
    inputBorder: 'rgba(0, 0, 0, 0.08)',
    dangerBg: 'rgba(255, 59, 48, 0.08)',
    dangerText: '#FF3B30',
    emptyIcon: 'rgba(0, 0, 0, 0.04)',
  };
}

// ---------------------------------------------------------------------------
// API (best-effort -- if the backend is unreachable we show an empty state)
// ---------------------------------------------------------------------------

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SYNC_API_URL) ||
  'https://writer-app-document-sync.inlaynoteapp.workers.dev';

async function fetchDocuments(token: string): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/api/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load documents');
  const data = await res.json();
  return (data.documents ?? data) as Document[];
}

async function createDocument(token: string): Promise<Document> {
  const res = await fetch(`${API_BASE}/api/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Untitled', content: { plainText: '', ops: [] } }),
  });
  if (!res.ok) throw new Error('Failed to create document');
  return (await res.json()) as Document;
}

async function deleteDocument(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete document');
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len).trimEnd() + '...';
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

export default function DocumentListPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isDark = usePrefersDark();
  const p = useMemo(() => getPalette(isDark), [isDark]);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredNew, setHoveredNew] = useState(false);

  // ---- Fetch documents on mount ----
  const loadDocuments = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const docs = await fetchDocuments(token);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    loadDocuments();
  }, [authLoading, isAuthenticated, navigate, loadDocuments]);

  // ---- Create ----
  const handleCreate = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const doc = await createDocument(token);
      navigate(`/editor/${doc.document_id}`);
    } catch {
      setError('Could not create a new document. Please try again.');
    }
  }, [navigate]);

  // ---- Delete ----
  const handleDelete = useCallback(async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteDocument(token, id);
      setDocuments((prev) => prev.filter((d) => d.document_id !== id));
    } catch {
      setError('Could not delete the document. Please try again.');
    }
  }, []);

  // ---- Filter ----
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.content?.plainText ?? '').toLowerCase().includes(q),
    );
  }, [documents, searchQuery]);

  // ---- Loading / auth guard ----
  if (authLoading) return null;
  if (!isAuthenticated) return null; // redirect handled in useEffect

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
    padding: '48px 24px',
  };

  const headerStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 880,
    marginBottom: 40,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  };

  const topRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 32,
    fontWeight: 400,
    letterSpacing: '-0.3px',
    margin: 0,
  };

  const newButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    borderRadius: 12,
    border: 'none',
    background: isDark ? 'rgba(255,255,255,0.95)' : '#1C1C1E',
    color: isDark ? '#0a0a0a' : '#FFFFFF',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
    transform: hoveredNew ? 'translateY(-1px)' : 'none',
    boxShadow: hoveredNew
      ? `0 6px 24px ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)'}`
      : 'none',
  };

  const searchStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 360,
    padding: '12px 16px 12px 40px',
    borderRadius: 12,
    border: `1px solid ${p.inputBorder}`,
    background: p.inputBg,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: p.text,
    fontSize: 14,
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: 'none',
    transition: 'border-color 0.25s ease, background 0.25s ease',
    boxSizing: 'border-box' as const,
  };

  const gridStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 880,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 20,
  };

  const makeCardStyle = (id: string): React.CSSProperties => {
    const hovered = hoveredCard === id;
    return {
      padding: 24,
      borderRadius: 28,
      background: p.cardBg,
      backdropFilter: 'blur(48px) saturate(160%)',
      WebkitBackdropFilter: 'blur(48px) saturate(160%)',
      border: p.cardBorder,
      boxShadow: hovered
        ? `0 12px 48px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)'}`
        : p.cardShadow,
      cursor: 'pointer',
      transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
      transform: hovered ? 'translateY(-4px)' : 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      position: 'relative' as const,
    };
  };

  const cardTitleStyle: React.CSSProperties = {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 18,
    fontWeight: 500,
    margin: 0,
    lineHeight: 1.3,
    color: p.text,
  };

  const cardPreviewStyle: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.5,
    color: p.textMuted,
    margin: 0,
    minHeight: 40,
  };

  const cardMetaStyle: React.CSSProperties = {
    fontSize: 11,
    color: p.textDim,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  };

  const deleteButtonStyle: React.CSSProperties = {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 8,
    border: 'none',
    background: p.dangerBg,
    color: p.dangerText,
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: hoveredCard ? 1 : 0,
    transition: 'opacity 0.2s ease',
    fontFamily: "'Inter', sans-serif",
  };

  const errorBannerStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 880,
    padding: '12px 16px',
    borderRadius: 14,
    background: p.dangerBg,
    backdropFilter: 'blur(12px)',
    border: `1px solid ${isDark ? 'rgba(255,59,48,0.2)' : 'rgba(255,59,48,0.15)'}`,
    color: p.dangerText,
    fontSize: 13,
    marginBottom: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const emptyStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 880,
    textAlign: 'center' as const,
    padding: '80px 24px',
  };

  const skeletonStyle: React.CSSProperties = {
    height: 160,
    borderRadius: 28,
    background: p.accentMuted,
    animation: 'pulse 1.8s ease-in-out infinite',
  };

  // =====================================================================
  //  Render
  // =====================================================================

  return (
    <div style={pageStyle}>
      {/* Inject pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>

      {/* Error banner */}
      {error && (
        <div style={errorBannerStyle}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: p.dangerText,
              cursor: 'pointer',
              fontSize: 16,
              fontFamily: "'Inter', sans-serif",
              padding: '0 4px',
            }}
            aria-label="Dismiss error"
          >
            x
          </button>
        </div>
      )}

      {/* Header */}
      <header style={headerStyle}>
        <div style={topRowStyle}>
          <h1 style={titleStyle}>Documents</h1>
          <button
            onClick={handleCreate}
            onMouseEnter={() => setHoveredNew(true)}
            onMouseLeave={() => setHoveredNew(false)}
            style={newButtonStyle}
          >
            {/* Plus icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New Document
          </button>
        </div>

        {/* Search (only show when there are documents) */}
        {documents.length > 0 && (
          <div style={{ position: 'relative' as const }}>
            {/* Search icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: p.textDim,
              }}
            >
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchStyle}
            />
          </div>
        )}
      </header>

      {/* Loading skeleton */}
      {loading && (
        <div style={gridStyle}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={skeletonStyle} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={emptyStyle}>
          {/* Pen icon */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: p.emptyIcon,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20 6l6 6L10 28H4v-6L20 6z"
                stroke={p.textDim}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: 22,
              fontWeight: 400,
              marginBottom: 8,
              color: p.text,
            }}
          >
            {searchQuery ? 'No results' : 'No documents yet'}
          </h2>
          <p style={{ color: p.textMuted, fontSize: 14, marginBottom: 28 }}>
            {searchQuery
              ? 'Try a different search term.'
              : 'Create your first document to start writing.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleCreate}
              onMouseEnter={() => setHoveredNew(true)}
              onMouseLeave={() => setHoveredNew(false)}
              style={newButtonStyle}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New Document
            </button>
          )}
        </div>
      )}

      {/* Document grid */}
      {!loading && filtered.length > 0 && (
        <div style={gridStyle}>
          {filtered.map((doc) => (
            <div
              key={doc.document_id}
              style={makeCardStyle(doc.document_id)}
              onClick={() => navigate(`/editor/${doc.document_id}`)}
              onMouseEnter={() => setHoveredCard(doc.document_id)}
              onMouseLeave={() => setHoveredCard(null)}
              role="button"
              tabIndex={0}
              aria-label={`Open ${doc.title || 'Untitled'}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/editor/${doc.document_id}`);
              }}
            >
              <h3 style={cardTitleStyle}>{doc.title || 'Untitled'}</h3>
              <p style={cardPreviewStyle}>
                {truncate(doc.content?.plainText || 'Empty document', 120)}
              </p>
              <div style={cardMetaStyle}>
                <span>{relativeTime(doc.updated_at)}</span>
                {doc.metadata?.wordCount != null && (
                  <span>{doc.metadata.wordCount} words</span>
                )}
              </div>

              {/* Delete button (visible on hover) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(doc.document_id);
                }}
                style={deleteButtonStyle}
                aria-label={`Delete ${doc.title || 'Untitled'}`}
                title="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4h10M5 4V2.5A.5.5 0 015.5 2h3a.5.5 0 01.5.5V4m1.5 0l-.5 8a1 1 0 01-1 1h-5a1 1 0 01-1-1l-.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Subtle user info in footer */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 48,
          fontSize: 12,
          color: p.textDim,
          textAlign: 'center' as const,
        }}
      >
        {user?.email}
      </div>
    </div>
  );
}
