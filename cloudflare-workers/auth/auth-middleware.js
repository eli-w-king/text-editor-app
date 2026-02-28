/**
 * Auth Middleware for Cloudflare Workers
 * 
 * Provides JWT validation middleware that can be used by any Cloudflare Worker
 * to protect its endpoints. Designed to work with the writer-app-auth worker's
 * JWT tokens.
 * 
 * Usage in a worker:
 * 
 *   import { withAuth, validateAuthToken, corsHeaders } from './auth-middleware.js';
 *   
 *   // Option 1: Wrap a handler function
 *   async function handleProtectedRoute(request, env, ctx) {
 *     // request.auth contains { sub, email, iat, exp }
 *     const userId = request.auth.sub;
 *     // ... your logic
 *   }
 *   
 *   // In your fetch handler:
 *   if (path === '/api/documents') {
 *     return withAuth(handleProtectedRoute)(request, env, ctx);
 *   }
 *   
 *   // Option 2: Manual validation
 *   const payload = await validateAuthToken(request, env.JWT_SECRET);
 *   if (!payload) {
 *     return new Response(JSON.stringify({ error: 'Unauthorized' }), {
 *       status: 401,
 *       headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
 *     });
 *   }
 *   
 *   // CORS: corsHeaders is a function that accepts a request and returns headers.
 *   // Use it in preflight handlers:
 *   //   if (request.method === 'OPTIONS') {
 *   //     return new Response(null, { status: 204, headers: corsHeaders(request) });
 *   //   }
 */

// ---------------------------------------------------------------------------
// CORS -- Origin-based allowlist (no wildcard)
// ---------------------------------------------------------------------------

/**
 * Allowed origins for CORS. Must match the auth worker's list.
 * Only these origins will receive a matching Access-Control-Allow-Origin.
 */
const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'https://inlaynoteapp.com',
  'https://app.inlaynoteapp.com',
  'https://www.inlaynoteapp.com',
];

/**
 * Build CORS headers for the given request.
 * Only reflects the request origin back if it is in the allowlist.
 * Handles null/empty origin for Electron desktop apps (sets 'null').
 *
 * If the origin is present but NOT in the allowlist, the
 * Access-Control-Allow-Origin header is omitted entirely. The browser
 * will reject the response, which is the secure default.
 *
 * This behavior is consistent with the auth worker (worker.js) and the
 * document-sync worker (cloudflare-workers/document-sync/worker.js).
 *
 * @param {Request} request - The incoming request
 * @returns {Record<string, string>} CORS headers object
 */
export function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

// ---------------------------------------------------------------------------
// JWT verification (standalone -- no external dependencies)
// ---------------------------------------------------------------------------

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  return atob(base64);
}

function base64UrlDecodeToBuffer(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Verify a JWT token signed with HMAC-SHA256.
 * Returns the decoded payload if valid and not expired, or null otherwise.
 *
 * Security checks:
 * 1. Input type validation (must be non-empty string)
 * 2. Structure validation (must have exactly 3 parts)
 * 3. Algorithm header validation (must be HS256 -- prevents 'alg: none' attack)
 * 4. HMAC-SHA256 signature verification
 * 5. Expiration check
 */
async function verifyJWT(token, secret) {
  try {
    // Guard: reject non-string or empty inputs
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Validate algorithm to prevent alg:none attack
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

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract and validate a JWT from the request's Authorization header.
 * 
 * @param {Request} request - The incoming request
 * @param {string} jwtSecret - The JWT signing secret
 * @returns {Promise<object|null>} The JWT payload or null if invalid
 */
export async function validateAuthToken(request, jwtSecret) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  // Guard: reject empty or non-string tokens before passing to verifyJWT
  if (!token || typeof token !== 'string') return null;
  return verifyJWT(token, jwtSecret);
}

/**
 * Higher-order function that wraps a request handler with auth validation.
 * If the token is valid, the decoded payload is attached to request.auth.
 * If invalid, returns a 401 JSON response with CORS headers.
 * 
 * Note: This function mutates the request object by adding an `auth` property
 * containing the decoded JWT payload ({ sub, email, iat, exp }). This relies
 * on the Cloudflare Workers runtime allowing property assignment on Request
 * instances (which it does, unlike browser implementations).
 * 
 * @param {Function} handler - async (request, env, ctx) => Response
 * @returns {Function} Wrapped handler with auth check
 */
export function withAuth(handler) {
  return async function authMiddleware(request, env, ctx) {
    const payload = await validateAuthToken(request, env.JWT_SECRET);

    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid or missing token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
        },
      );
    }

    // Attach auth payload to request for downstream use
    request.auth = payload;

    return handler(request, env, ctx);
  };
}
