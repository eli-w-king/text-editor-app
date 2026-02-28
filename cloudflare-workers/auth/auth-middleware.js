/**
 * Auth Middleware for Cloudflare Workers
 * 
 * Provides JWT validation middleware that can be used by any Cloudflare Worker
 * to protect its endpoints. Designed to work with the writer-app-auth worker's
 * JWT tokens.
 * 
 * Usage in a worker:
 * 
 *   import { withAuth, validateAuthToken } from './auth-middleware.js';
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
 *     return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
 *   }
 */

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
 */
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
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
  if (!token) return null;
  return verifyJWT(token, jwtSecret);
}

/**
 * Higher-order function that wraps a request handler with auth validation.
 * If the token is valid, the decoded payload is attached to request.auth.
 * If invalid, returns a 401 JSON response.
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
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Attach auth payload to request for downstream use
    // Using a non-standard property since Request is read-only
    request.auth = payload;

    return handler(request, env, ctx);
  };
}

/**
 * CORS headers helper -- use the same pattern as the auth worker.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
