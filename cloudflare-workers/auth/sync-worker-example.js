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
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed request body size in bytes (10 KB). */
const MAX_BODY_SIZE = 10 * 1024;

/** Regex for valid document IDs -- alphanumeric, hyphens, underscores, 1-128 chars. */
const DOCUMENT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Build a JSON response with CORS headers derived from the request origin.
 *
 * @param {Request} request - The incoming request (used for CORS origin check)
 * @param {object} body - Response body to serialize
 * @param {number} [status=200] - HTTP status code
 * @returns {Response}
 */
function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

/**
 * Read and parse the request body as JSON, enforcing a size limit.
 * Returns the parsed object, or a Response if the body is too large or invalid.
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<{ data?: object, error?: Response }>}
 */
async function parseJsonBody(request) {
  // Check Content-Length header first for an early rejection
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return {
      error: jsonResponse(request, { error: 'Request body too large. Maximum size is 10KB.' }, 413),
    };
  }

  // Read the body as text so we can enforce the byte-level limit even when
  // Content-Length is absent (e.g. chunked transfer)
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_SIZE) {
    return {
      error: jsonResponse(request, { error: 'Request body too large. Maximum size is 10KB.' }, 413),
    };
  }

  try {
    return { data: JSON.parse(text) };
  } catch {
    return {
      error: jsonResponse(request, { error: 'Invalid JSON body' }, 400),
    };
  }
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

  return jsonResponse(request, { documents });
}

/**
 * POST /api/documents -- create or update a document
 */
async function handleSaveDocument(request, env) {
  const userId = request.auth.sub;

  const { data: body, error } = await parseJsonBody(request);
  if (error) return error;

  const { id, title, content } = body;
  if (!id || !content) {
    return jsonResponse(request, { error: 'Missing required fields: id, content' }, 400);
  }

  // Validate document ID to prevent KV key injection
  if (!DOCUMENT_ID_REGEX.test(id)) {
    return jsonResponse(
      request,
      { error: 'Invalid document id. Must be 1-128 alphanumeric, hyphen, or underscore characters.' },
      400,
    );
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

  return jsonResponse(request, { document: doc });
}

/**
 * GET /api/documents/:id -- fetch a single document
 */
async function handleGetDocument(request, env, docId) {
  const userId = request.auth.sub;

  const docJSON = await env.DOCUMENTS_KV.get(`docs:user:${userId}:doc:${docId}`);
  if (!docJSON) {
    return jsonResponse(request, { error: 'Document not found' }, 404);
  }

  return jsonResponse(request, { document: JSON.parse(docJSON) });
}

// ---------------------------------------------------------------------------
// Main request handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }

      // Health check (public)
      if (path === '/' || path === '/health') {
        if (request.method !== 'GET') {
          return jsonResponse(request, { error: 'Method not allowed' }, 405);
        }
        return jsonResponse(request, {
          status: 'ok',
          service: 'writer-app-sync',
          timestamp: new Date().toISOString(),
        });
      }

      // ----- /api/documents routes (require auth) -----

      if (path === '/api/documents') {
        if (request.method === 'GET') {
          return withAuth(handleListDocuments)(request, env, ctx);
        }
        if (request.method === 'POST') {
          return withAuth(handleSaveDocument)(request, env, ctx);
        }
        // Known path, wrong method
        return jsonResponse(request, { error: 'Method not allowed' }, 405);
      }

      // Match /api/documents/:id
      const docMatch = path.match(/^\/api\/documents\/([a-zA-Z0-9_-]+)$/);
      if (docMatch) {
        if (request.method !== 'GET') {
          return jsonResponse(request, { error: 'Method not allowed' }, 405);
        }
        const docId = docMatch[1];
        return withAuth(async (req, e, c) => {
          return handleGetDocument(req, e, docId);
        })(request, env, ctx);
      }

      return jsonResponse(request, { error: 'Not found' }, 404);
    } catch {
      // Global error handler -- never leak internal details to the client.
      // Include CORS headers so the browser can read the error response.
      const hdrs = corsHeaders(request);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { ...hdrs, 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
