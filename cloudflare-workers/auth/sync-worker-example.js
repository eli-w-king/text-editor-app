/**
 * Example: Document Sync Worker with Auth Middleware
 * 
 * This file demonstrates how to integrate the auth middleware with a
 * Cloudflare Worker for document synchronization. It validates JWT tokens
 * from the writer-app-auth service before allowing access to sync endpoints.
 * 
 * This is a reference implementation -- the actual document sync worker
 * should be built on top of this pattern.
 * 
 * Environment bindings required:
 *   - JWT_SECRET: Same secret used by the auth worker (set via wrangler secret)
 *   - DOCUMENTS_KV: KV namespace for document storage (optional, for sync)
 */

import { validateAuthToken, withAuth, corsHeaders } from './auth-middleware.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Protected route handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/documents -- list all documents for the authenticated user
 */
async function handleListDocuments(request, env) {
  const userId = request.auth.sub;

  // Fetch user's document index from KV
  const indexKey = `docs:user:${userId}:index`;
  const indexJSON = await env.DOCUMENTS_KV.get(indexKey);
  const documents = indexJSON ? JSON.parse(indexJSON) : [];

  return jsonResponse({ documents });
}

/**
 * POST /api/documents -- create or update a document
 */
async function handleSaveDocument(request, env) {
  const userId = request.auth.sub;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { id, title, content } = body;
  if (!id || !content) {
    return jsonResponse({ error: 'Missing required fields: id, content' }, 400);
  }

  const doc = {
    id,
    user_id: userId,
    title: title || 'Untitled',
    content,
    updated_at: new Date().toISOString(),
  };

  // Store the document
  await env.DOCUMENTS_KV.put(`docs:user:${userId}:doc:${id}`, JSON.stringify(doc));

  // Update the user's document index
  const indexKey = `docs:user:${userId}:index`;
  const indexJSON = await env.DOCUMENTS_KV.get(indexKey);
  const index = indexJSON ? JSON.parse(indexJSON) : [];

  const existingIdx = index.findIndex(d => d.id === id);
  const indexEntry = { id, title: doc.title, updated_at: doc.updated_at };

  if (existingIdx >= 0) {
    index[existingIdx] = indexEntry;
  } else {
    index.unshift(indexEntry);
  }

  await env.DOCUMENTS_KV.put(indexKey, JSON.stringify(index));

  return jsonResponse({ document: doc });
}

/**
 * GET /api/documents/:id -- fetch a single document
 */
async function handleGetDocument(request, env, docId) {
  const userId = request.auth.sub;

  const docJSON = await env.DOCUMENTS_KV.get(`docs:user:${userId}:doc:${docId}`);
  if (!docJSON) {
    return jsonResponse({ error: 'Document not found' }, 404);
  }

  return jsonResponse({ document: JSON.parse(docJSON) });
}

// ---------------------------------------------------------------------------
// Main request handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check (public)
    if (path === '/' || path === '/health') {
      return jsonResponse({
        status: 'ok',
        service: 'writer-app-sync',
        timestamp: new Date().toISOString(),
      });
    }

    // All /api/documents routes require auth
    if (path === '/api/documents' && request.method === 'GET') {
      return withAuth(handleListDocuments)(request, env, ctx);
    }

    if (path === '/api/documents' && request.method === 'POST') {
      return withAuth(handleSaveDocument)(request, env, ctx);
    }

    // Match /api/documents/:id
    const docMatch = path.match(/^\/api\/documents\/([a-zA-Z0-9_-]+)$/);
    if (docMatch && request.method === 'GET') {
      const docId = docMatch[1];
      return withAuth(async (req, env, ctx) => {
        return handleGetDocument(req, env, docId);
      })(request, env, ctx);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};
