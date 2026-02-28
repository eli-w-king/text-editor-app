/**
 * Document Sync Cloudflare Worker
 *
 * Implements a document sync API backed by Cloudflare R2 storage with
 * JWT-based authentication. Documents are stored as JSON files at paths like:
 *   documents/{user_id}/{document_id}.json
 * with an index file at:
 *   documents/{user_id}/_index.json
 *
 * All /api/* routes require a valid JWT issued by the writer-app-auth service.
 *
 * Environment bindings:
 *   - DOCUMENTS_BUCKET: R2 bucket for document storage (configured in wrangler.toml)
 *   - JWT_SECRET:       Shared HMAC-SHA256 signing key (set via `wrangler secret put JWT_SECRET`)
 *
 * Endpoints:
 *   GET    /health              - Public health check
 *   GET    /api/documents       - List user's documents (authenticated)
 *   POST   /api/documents       - Create a new document (authenticated)
 *   GET    /api/documents/:id   - Get a single document (authenticated)
 *   PUT    /api/documents/:id   - Update a document (authenticated)
 *   DELETE /api/documents/:id   - Delete a document (authenticated)
 *
 * Security features:
 *   - JWT authentication with algorithm validation (HS256 only)
 *   - Origin-based CORS allowlist (no wildcard, omits header for unknown origins)
 *   - Document ID validation (prevents path traversal in R2 keys)
 *   - Content size limits (1 MB max)
 *   - Title length limits (500 chars max)
 *   - Sort field validation (whitelist-based)
 *   - 405 responses for wrong HTTP methods on known routes
 *   - Global error handler (no stack trace leaks to clients)
 *   - Health endpoint does not leak configuration details
 *
 * Deploy: cd cloudflare-workers/document-sync && npx wrangler deploy
 * Set secret: npx wrangler secret put JWT_SECRET
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed document content size in bytes (1 MB). */
const MAX_CONTENT_SIZE_BYTES = 1_048_576;

/** Maximum title length in characters. */
const MAX_TITLE_LENGTH = 500;

/**
 * Allowed document ID pattern: alphanumerics, hyphens, underscores, 1-128 chars.
 * This prevents path traversal and injection via R2 keys.
 */
const DOCUMENT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

// ---------------------------------------------------------------------------
// CORS Configuration -- Origin-based allowlist (no wildcard)
//
// Behavior (consistent with auth worker.js and auth-middleware.js):
//   - If the request Origin is in the allowlist, reflect it back.
//   - If the Origin is null or empty (e.g. Electron desktop apps),
//     set Access-Control-Allow-Origin to 'null'.
//   - If the Origin is present but NOT in the allowlist, do NOT set
//     Access-Control-Allow-Origin at all. The browser will reject the
//     response, which is the secure default.
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'https://inlaynoteapp.com',
  'https://app.inlaynoteapp.com',
  'https://www.inlaynoteapp.com',
];

/**
 * Build CORS headers for the given request origin.
 * Only reflects the origin back if it is in the allow-list.
 * Handles null/empty origin for Electron desktop apps.
 */
function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Document-Version',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };

  if (!origin) {
    // Null/empty origin: Electron desktop apps, server-to-server, etc.
    headers['Access-Control-Allow-Origin'] = 'null';
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  // If origin is present but not in allowlist, omit the header entirely.
  // The browser will block the response (secure default).

  return headers;
}

/**
 * Handle CORS preflight requests.
 */
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

// ---------------------------------------------------------------------------
// Response Helpers
// ---------------------------------------------------------------------------

/**
 * Return a JSON Response with CORS headers.
 */
function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Return a standardized error response. Never leaks internal details.
 */
function errorResponse(request, message, status, code) {
  const body = { error: message };
  if (code) body.code = code;
  return jsonResponse(request, body, status);
}

// ---------------------------------------------------------------------------
// JWT Verification (self-contained, no external dependencies)
// ---------------------------------------------------------------------------

/**
 * Decode a base64url-encoded string to a regular string.
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  return atob(base64);
}

/**
 * Decode a base64url-encoded string to an ArrayBuffer.
 */
function base64UrlDecodeToBuffer(str) {
  const binary = base64UrlDecode(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Verify a JWT signed with HMAC-SHA256.
 * Returns the decoded payload if valid and not expired, or null otherwise.
 *
 * Security checks:
 * 1. Input type validation (must be non-empty string)
 * 2. Structure validation (must have exactly 3 parts)
 * 3. Algorithm header validation (must be HS256 -- prevents 'alg: none' attack)
 * 4. HMAC-SHA256 signature verification via crypto.subtle
 * 5. Expiration check
 * 6. Requires `sub` claim (user ID)
 *
 * @param {string} token  The raw JWT string.
 * @param {string} secret The shared HMAC signing secret.
 * @returns {Promise<object|null>}
 */
async function verifyJWT(token, secret) {
  try {
    if (typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Validate algorithm header to prevent 'alg: none' attack
    let header;
    try {
      header = JSON.parse(base64UrlDecode(encodedHeader));
    } catch {
      return null;
    }
    if (!header || header.alg !== 'HS256') return null;

    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signatureBuffer = base64UrlDecodeToBuffer(encodedSignature);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      encoder.encode(signingInput),
    );

    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // Reject expired tokens
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    // Require the `sub` claim (user ID) -- all auth-worker JWTs include this
    if (!payload.sub) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and validate a Bearer JWT from the Authorization header.
 *
 * @param {Request} request    The incoming request.
 * @param {string}  jwtSecret  The shared HMAC signing secret.
 * @returns {Promise<object|null>} Decoded JWT payload or null.
 */
async function authenticateRequest(request, jwtSecret) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  return verifyJWT(token, jwtSecret);
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Validate a document ID format. Prevents path traversal in R2 keys.
 */
function isValidDocumentId(id) {
  return typeof id === 'string' && DOCUMENT_ID_REGEX.test(id);
}

// ---------------------------------------------------------------------------
// R2 Key Helpers
// ---------------------------------------------------------------------------

/**
 * R2 key for a single document.
 */
function documentKey(userId, documentId) {
  return `documents/${userId}/${documentId}.json`;
}

/**
 * R2 key for the user's document index.
 */
function indexKey(userId) {
  return `documents/${userId}/_index.json`;
}

// ---------------------------------------------------------------------------
// Index Management
//
// Each user has an _index.json file in R2 that contains an array of document
// summaries. This allows the list endpoint to return results without reading
// every individual document file.
// ---------------------------------------------------------------------------

/**
 * Read the user's index from R2. Returns an array of document summaries.
 */
async function readIndex(bucket, userId) {
  const key = indexKey(userId);
  const obj = await bucket.get(key);
  if (!obj) return [];
  try {
    const data = await obj.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Write the user's index back to R2.
 */
async function writeIndex(bucket, userId, index) {
  const key = indexKey(userId);
  await bucket.put(key, JSON.stringify(index), {
    httpMetadata: { contentType: 'application/json' },
  });
}

/**
 * Build a summary object from a full document (for the index).
 */
function buildSummary(doc) {
  return {
    document_id: doc.document_id,
    title: doc.title,
    updated_at: doc.updated_at,
    created_at: doc.created_at,
    deleted_at: doc.deleted_at,
    version: doc.version,
    wordCount: doc.metadata?.wordCount ?? 0,
    isPinned: doc.metadata?.isPinned ?? false,
    isArchived: doc.metadata?.isArchived ?? false,
  };
}

/**
 * Upsert a document summary into the index and persist it.
 */
async function upsertIndex(bucket, userId, doc) {
  const index = await readIndex(bucket, userId);
  const summary = buildSummary(doc);
  const existingIdx = index.findIndex((s) => s.document_id === doc.document_id);
  if (existingIdx >= 0) {
    index[existingIdx] = summary;
  } else {
    index.push(summary);
  }
  await writeIndex(bucket, userId, index);
  return index;
}

/**
 * Remove a document from the index (used for permanent deletes).
 */
async function removeFromIndex(bucket, userId, documentId) {
  const index = await readIndex(bucket, userId);
  const filtered = index.filter((s) => s.document_id !== documentId);
  await writeIndex(bucket, userId, filtered);
  return filtered;
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

/**
 * GET /health
 *
 * Public health check. Does NOT leak configuration details (env bindings,
 * secret availability, etc.) to prevent reconnaissance.
 */
function handleHealth(request) {
  return jsonResponse(request, {
    status: 'ok',
    service: 'writer-app-document-sync',
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/documents -- Create a new document.
 *
 * Accepts a JSON body with optional title, content, and metadata fields.
 * Server generates document_id (UUID v4) and sets version to 1.
 */
async function handleCreateDocument(request, env, userId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, 'Invalid JSON body', 400, 'INVALID_JSON');
  }

  // Validate content size if provided
  if (body.content != null) {
    const contentStr = typeof body.content === 'string'
      ? body.content
      : JSON.stringify(body.content);
    if (new TextEncoder().encode(contentStr).length > MAX_CONTENT_SIZE_BYTES) {
      return errorResponse(
        request,
        `Content exceeds maximum size of ${MAX_CONTENT_SIZE_BYTES} bytes`,
        413,
        'CONTENT_TOO_LARGE',
      );
    }
  }

  // Sanitize title
  const title = typeof body.title === 'string'
    ? body.title.slice(0, MAX_TITLE_LENGTH)
    : 'Untitled';

  const now = new Date().toISOString();

  const doc = {
    document_id: crypto.randomUUID(),
    user_id: userId,
    title,
    content: body.content || {
      type: 'delta',
      ops: [],
      plainText: '',
      format: 'delta-v1',
    },
    metadata: {
      wordCount: body.metadata?.wordCount ?? 0,
      characterCount: body.metadata?.characterCount ?? 0,
      colorFamily: body.metadata?.colorFamily ?? null,
      colorDots: body.metadata?.colorDots ?? [],
      tags: body.metadata?.tags ?? [],
      isPinned: body.metadata?.isPinned ?? false,
      isArchived: body.metadata?.isArchived ?? false,
    },
    version: 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  // Store document in R2
  const key = documentKey(userId, doc.document_id);
  await env.DOCUMENTS_BUCKET.put(key, JSON.stringify(doc), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Update index
  await upsertIndex(env.DOCUMENTS_BUCKET, userId, doc);

  return jsonResponse(request, doc, 201);
}

/**
 * GET /api/documents -- List documents for the current user.
 *
 * Query params:
 *   include_deleted=true  -- include soft-deleted documents
 *   sort=updated_at       -- field to sort by (default: updated_at)
 *   order=desc            -- sort direction (default: desc)
 */
async function handleListDocuments(request, env, userId) {
  const url = new URL(request.url);

  const includeDeleted = url.searchParams.get('include_deleted') === 'true';
  const sortField = url.searchParams.get('sort') || 'updated_at';
  const order = url.searchParams.get('order') || 'desc';

  // Only allow sorting by known fields to prevent unexpected behavior
  const allowedSortFields = ['updated_at', 'created_at', 'title', 'version'];
  const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'updated_at';

  let index = await readIndex(env.DOCUMENTS_BUCKET, userId);

  // Filter out soft-deleted unless requested
  if (!includeDeleted) {
    index = index.filter((s) => !s.deleted_at);
  }

  // Sort
  index.sort((a, b) => {
    const aVal = a[safeSortField] ?? '';
    const bVal = b[safeSortField] ?? '';
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return jsonResponse(request, { documents: index, total: index.length });
}

/**
 * GET /api/documents/:id -- Get a single document.
 */
async function handleGetDocument(request, env, userId, documentId) {
  if (!isValidDocumentId(documentId)) {
    return errorResponse(request, 'Invalid document ID', 400, 'INVALID_DOCUMENT_ID');
  }

  const key = documentKey(userId, documentId);
  const obj = await env.DOCUMENTS_BUCKET.get(key);

  if (!obj) {
    return errorResponse(request, 'Document not found', 404, 'NOT_FOUND');
  }

  let doc;
  try {
    doc = await obj.json();
  } catch {
    return errorResponse(request, 'Failed to read document', 500, 'STORAGE_ERROR');
  }

  return jsonResponse(request, doc);
}

/**
 * PUT /api/documents/:id -- Update a document.
 *
 * Supports optimistic concurrency via the X-Document-Version header:
 *   - Client sends X-Document-Version with its known version number.
 *   - If client version < stored version, returns 409 with the stored document
 *     so the client can merge or override.
 *   - Otherwise, increments version and saves.
 */
async function handleUpdateDocument(request, env, userId, documentId) {
  if (!isValidDocumentId(documentId)) {
    return errorResponse(request, 'Invalid document ID', 400, 'INVALID_DOCUMENT_ID');
  }

  const key = documentKey(userId, documentId);

  // Read existing document
  const obj = await env.DOCUMENTS_BUCKET.get(key);
  if (!obj) {
    return errorResponse(request, 'Document not found', 404, 'NOT_FOUND');
  }

  let storedDoc;
  try {
    storedDoc = await obj.json();
  } catch {
    return errorResponse(request, 'Failed to read document', 500, 'STORAGE_ERROR');
  }

  // Version conflict check
  const clientVersionHeader = request.headers.get('X-Document-Version');
  if (clientVersionHeader !== null) {
    const clientVersion = parseInt(clientVersionHeader, 10);
    if (!isNaN(clientVersion) && clientVersion < storedDoc.version) {
      return jsonResponse(
        request,
        {
          error: 'Conflict: document has been modified',
          code: 'VERSION_CONFLICT',
          server_version: storedDoc.version,
          client_version: clientVersion,
          document: storedDoc,
        },
        409,
      );
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, 'Invalid JSON body', 400, 'INVALID_JSON');
  }

  // Validate content size if updated
  if (body.content !== undefined) {
    const contentStr = typeof body.content === 'string'
      ? body.content
      : JSON.stringify(body.content);
    if (new TextEncoder().encode(contentStr).length > MAX_CONTENT_SIZE_BYTES) {
      return errorResponse(
        request,
        `Content exceeds maximum size of ${MAX_CONTENT_SIZE_BYTES} bytes`,
        413,
        'CONTENT_TOO_LARGE',
      );
    }
  }

  const now = new Date().toISOString();

  // Merge updates onto stored document -- partial updates supported
  const updatedDoc = {
    ...storedDoc,
    title: body.title !== undefined
      ? (typeof body.title === 'string' ? body.title.slice(0, MAX_TITLE_LENGTH) : storedDoc.title)
      : storedDoc.title,
    content: body.content !== undefined ? body.content : storedDoc.content,
    metadata: {
      ...storedDoc.metadata,
      ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
    },
    version: storedDoc.version + 1,
    updated_at: now,
    // Allow restoring a soft-deleted document by setting deleted_at to null
    deleted_at: body.deleted_at !== undefined ? body.deleted_at : storedDoc.deleted_at,
  };

  // Persist
  await env.DOCUMENTS_BUCKET.put(key, JSON.stringify(updatedDoc), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Update index
  await upsertIndex(env.DOCUMENTS_BUCKET, userId, updatedDoc);

  return jsonResponse(request, updatedDoc);
}

/**
 * DELETE /api/documents/:id -- Delete a document.
 *
 * By default, performs a soft delete (sets deleted_at).
 * Pass ?permanent=true to hard-delete the document from R2.
 */
async function handleDeleteDocument(request, env, userId, documentId) {
  if (!isValidDocumentId(documentId)) {
    return errorResponse(request, 'Invalid document ID', 400, 'INVALID_DOCUMENT_ID');
  }

  const key = documentKey(userId, documentId);
  const url = new URL(request.url);
  const permanent = url.searchParams.get('permanent') === 'true';

  // Verify document exists
  const obj = await env.DOCUMENTS_BUCKET.get(key);
  if (!obj) {
    return errorResponse(request, 'Document not found', 404, 'NOT_FOUND');
  }

  if (permanent) {
    // Hard delete -- remove from R2 and from the index
    await env.DOCUMENTS_BUCKET.delete(key);
    await removeFromIndex(env.DOCUMENTS_BUCKET, userId, documentId);
    return jsonResponse(request, { deleted: true, document_id: documentId, permanent: true });
  }

  // Soft delete -- set deleted_at timestamp
  let storedDoc;
  try {
    storedDoc = await obj.json();
  } catch {
    return errorResponse(request, 'Failed to read document', 500, 'STORAGE_ERROR');
  }

  const now = new Date().toISOString();
  storedDoc.deleted_at = now;
  storedDoc.updated_at = now;
  storedDoc.version += 1;

  await env.DOCUMENTS_BUCKET.put(key, JSON.stringify(storedDoc), {
    httpMetadata: { contentType: 'application/json' },
  });

  await upsertIndex(env.DOCUMENTS_BUCKET, userId, storedDoc);

  return jsonResponse(request, storedDoc);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Simple path matcher for /api/documents/:id patterns.
 * Returns the document ID if matched, or null otherwise.
 */
function matchDocumentId(pathname) {
  const match = pathname.match(/^\/api\/documents\/([a-zA-Z0-9_-]+)$/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight for all routes
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }

    try {
      // Health check (public, no auth required)
      if (path === '/health' || path === '/') {
        if (method !== 'GET') {
          return errorResponse(request, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
        }
        return handleHealth(request);
      }

      // All /api/* routes require authentication
      if (!path.startsWith('/api/')) {
        return errorResponse(request, 'Not found', 404, 'NOT_FOUND');
      }

      // Verify required env bindings are configured
      if (!env.JWT_SECRET || !env.DOCUMENTS_BUCKET) {
        // Log the config error server-side but don't expose details to clients
        console.error('Missing required env bindings: JWT_SECRET and/or DOCUMENTS_BUCKET');
        return errorResponse(request, 'Internal server error', 500, 'INTERNAL_ERROR');
      }

      // Authenticate the request via JWT
      const auth = await authenticateRequest(request, env.JWT_SECRET);
      if (!auth) {
        return errorResponse(
          request,
          'Unauthorized - invalid or missing authentication token',
          401,
          'UNAUTHORIZED',
        );
      }

      // Use the JWT `sub` claim as the user ID (set by the auth worker)
      const userId = auth.sub;

      // Route to handlers
      // Document collection routes
      if (path === '/api/documents') {
        if (method === 'POST') {
          return await handleCreateDocument(request, env, userId);
        }
        if (method === 'GET') {
          return await handleListDocuments(request, env, userId);
        }
        return errorResponse(request, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
      }

      // Individual document routes
      const documentId = matchDocumentId(path);
      if (documentId) {
        if (method === 'GET') {
          return await handleGetDocument(request, env, userId, documentId);
        }
        if (method === 'PUT') {
          return await handleUpdateDocument(request, env, userId, documentId);
        }
        if (method === 'DELETE') {
          return await handleDeleteDocument(request, env, userId, documentId);
        }
        return errorResponse(request, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
      }

      // Not found
      return errorResponse(request, 'Not found', 404, 'NOT_FOUND');
    } catch (err) {
      // Catch-all for unexpected errors. Log internally but never expose
      // stack traces or internal error details to clients.
      console.error('Unhandled error:', err);
      return errorResponse(request, 'Internal server error', 500, 'INTERNAL_ERROR');
    }
  },
};
