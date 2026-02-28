/**
 * Writer App Auth Worker for Cloudflare Workers
 *
 * Handles user registration, login, and JWT-based authentication.
 * Uses KV for user storage and crypto.subtle for password hashing (PBKDF2)
 * and JWT signing (HMAC-SHA256).
 *
 * Deploy: npx wrangler deploy
 * Set secret: npx wrangler secret put JWT_SECRET
 *
 * KV storage pattern:
 *   user:email:{email}            -> JSON user object
 *   user:id:{id}                  -> JSON user object
 *   ratelimit:{ip}:{action}       -> attempt count (auto-expires via TTL)
 *
 * Security features:
 *   - PBKDF2-SHA256 password hashing (100k iterations)
 *   - Timing-safe password comparison
 *   - IP-based rate limiting on login/register
 *   - Request body size limits (10KB max)
 *   - Input validation with length bounds
 *   - Global error handler (no stack trace leaks)
 *   - 405 responses for wrong HTTP methods
 *   - No secrets or config details in responses
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_REQUEST_BODY_BYTES = 10 * 1024; // 10 KB
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

// Rate limit settings (per IP, per action, approximate via KV TTL)
const RATE_LIMIT_LOGIN_MAX = 10; // max attempts per window
const RATE_LIMIT_REGISTER_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute window

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

// CORS headers for cross-origin requests.
// MVP: allow all origins. In production, restrict to your app's domain(s).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle preflight OPTIONS requests.
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a JSON response with CORS headers.
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Generate a UUID v4 using the Web Crypto API.
 */
function generateUUID() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Set version (4) and variant (RFC 4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Get the client IP from the request.
 * Cloudflare Workers provide CF-Connecting-IP automatically.
 */
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// ---------------------------------------------------------------------------
// Rate Limiting (KV-based, approximate)
// ---------------------------------------------------------------------------

/**
 * Check and increment rate limit for a given IP and action.
 * Uses USERS_KV with TTL for automatic expiration.
 *
 * Returns true if the request is allowed, false if rate-limited.
 *
 * Note: KV reads/writes are eventually consistent, so this is approximate.
 * For strict rate limiting, consider Durable Objects. This is sufficient for
 * brute-force prevention on an MVP.
 */
async function checkRateLimit(env, ip, action, maxAttempts) {
  const key = `ratelimit:${ip}:${action}`;

  try {
    const current = await env.USERS_KV.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= maxAttempts) {
      return false;
    }

    // Increment counter with TTL
    await env.USERS_KV.put(key, String(count + 1), {
      expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
    });

    return true;
  } catch {
    // If rate limiting fails (KV error), allow the request through
    // rather than blocking legitimate users.
    return true;
  }
}

// ---------------------------------------------------------------------------
// Request body parsing with size limits
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON request body with size limits.
 * Returns { data, error } where error is a Response if parsing failed.
 */
async function parseJsonBody(request) {
  // Check Content-Length header for early rejection
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_BODY_BYTES) {
    return { data: null, error: jsonResponse({ error: 'Request body too large' }, 413) };
  }

  try {
    const text = await request.text();
    if (text.length > MAX_REQUEST_BODY_BYTES) {
      return { data: null, error: jsonResponse({ error: 'Request body too large' }, 413) };
    }
    const data = JSON.parse(text);
    return { data, error: null };
  } catch {
    return { data: null, error: jsonResponse({ error: 'Invalid JSON body' }, 400) };
  }
}

// ---------------------------------------------------------------------------
// Password hashing (PBKDF2-SHA256)
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16; // bytes
const KEY_LENGTH = 32; // bytes (256 bits)

/**
 * Hash a password with PBKDF2-SHA256.
 * Returns { hash: base64, salt: base64 }.
 */
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );

  return {
    hash: arrayBufferToBase64(derivedBits),
    salt: arrayBufferToBase64(salt.buffer),
  };
}

/**
 * Verify a password against a stored hash and salt.
 * Uses timing-safe comparison to prevent timing attacks.
 */
async function verifyPassword(password, storedHash, storedSalt) {
  const salt = base64ToUint8Array(storedSalt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );

  const computedHash = arrayBufferToBase64(derivedBits);
  return timingSafeEqual(computedHash, storedHash);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Always iterates over the full length of the longer string to prevent
 * leaking length information through timing. The lengthMismatch flag
 * ensures different-length strings always return false without short-circuiting.
 */
function timingSafeEqual(a, b) {
  const maxLen = Math.max(a.length, b.length);
  let lengthMismatch = a.length !== b.length ? 1 : 0;
  let mismatch = 0;
  for (let i = 0; i < maxLen; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return (mismatch | lengthMismatch) === 0;
}

// ---------------------------------------------------------------------------
// Base64 utilities
// ---------------------------------------------------------------------------

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// JWT (HMAC-SHA256)
// ---------------------------------------------------------------------------

const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Base64url encode a string (no padding).
 */
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64url decode a string.
 */
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

/**
 * Import the JWT secret as a CryptoKey for HMAC-SHA256.
 */
async function getSigningKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Create a signed JWT.
 * Payload: { sub: userId, email: email, iat: timestamp, exp: timestamp+7days }
 */
async function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = base64urlEncode(
    String.fromCharCode(...new Uint8Array(signature)),
  );

  return `${signingInput}.${encodedSignature}`;
}

/**
 * Verify and decode a JWT. Returns the payload or null if invalid/expired.
 * Wrapped in try/catch to safely handle any malformed input.
 */
async function verifyJWT(token, secret) {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const key = await getSigningKey(secret);

    // Reconstruct signature bytes
    const signatureStr = base64urlDecode(encodedSignature);
    const signatureBytes = new Uint8Array(signatureStr.length);
    for (let i = 0; i < signatureStr.length; i++) {
      signatureBytes[i] = signatureStr.charCodeAt(i);
    }

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(signingInput),
    );

    if (!valid) {
      return null;
    }

    const payload = JSON.parse(base64urlDecode(encodedPayload));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    // Catch any decoding/parsing errors and return null
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an email address format and length.
 * Max: 254 characters per RFC 5321.
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > MAX_EMAIL_LENGTH) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password meets minimum and maximum length requirements.
 * Min: 8 characters. Max: 128 characters.
 */
function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/register
 *
 * Accepts { email, password }.
 * Validates input, checks for existing user, creates user in KV, returns JWT.
 */
async function handleRegister(request, env) {
  // Rate limit check
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env, ip, 'register', RATE_LIMIT_REGISTER_MAX);
  if (!allowed) {
    return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429);
  }

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { email, password } = body;

  // Validate email
  if (!email || !isValidEmail(email)) {
    return jsonResponse({ error: 'Invalid email format' }, 400);
  }

  // Validate password
  if (!password || !isValidPassword(password)) {
    return jsonResponse(
      { error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters long` },
      400,
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await env.USERS_KV.get(`user:email:${normalizedEmail}`);
  if (existingUser) {
    return jsonResponse({ error: 'A user with this email already exists' }, 409);
  }

  // Hash password
  const { hash, salt } = await hashPassword(password);

  // Create user object
  const userId = generateUUID();
  const now = new Date().toISOString();
  const user = {
    id: userId,
    email: normalizedEmail,
    password_hash: hash,
    salt: salt,
    created_at: now,
  };

  // Store in KV (both by email and by ID for lookups)
  const userJson = JSON.stringify(user);
  await env.USERS_KV.put(`user:email:${normalizedEmail}`, userJson);
  await env.USERS_KV.put(`user:id:${userId}`, userJson);

  // Generate JWT
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    // Do not reveal which config is missing to external callers
    return jsonResponse({ error: 'Internal server error' }, 500);
  }

  const token = await createJWT({ sub: userId, email: normalizedEmail }, jwtSecret);

  return jsonResponse({
    token,
    user: {
      id: userId,
      email: normalizedEmail,
      created_at: now,
    },
  }, 201);
}

/**
 * POST /api/auth/login
 *
 * Accepts { email, password }.
 * Looks up user by email, verifies password, returns JWT.
 */
async function handleLogin(request, env) {
  // Rate limit check
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env, ip, 'login', RATE_LIMIT_LOGIN_MAX);
  if (!allowed) {
    return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429);
  }

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { email, password } = body;

  if (!email || !password) {
    return jsonResponse({ error: 'Email and password are required' }, 400);
  }

  // Validate types to prevent unexpected behavior
  if (typeof email !== 'string' || typeof password !== 'string') {
    return jsonResponse({ error: 'Email and password must be strings' }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Look up user
  const userJson = await env.USERS_KV.get(`user:email:${normalizedEmail}`);
  if (!userJson) {
    // Use a generic message to avoid leaking whether the email exists
    return jsonResponse({ error: 'Invalid email or password' }, 401);
  }

  const user = JSON.parse(userJson);

  // Verify password
  const passwordValid = await verifyPassword(password, user.password_hash, user.salt);
  if (!passwordValid) {
    return jsonResponse({ error: 'Invalid email or password' }, 401);
  }

  // Generate JWT
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return jsonResponse({ error: 'Internal server error' }, 500);
  }

  const token = await createJWT({ sub: user.id, email: user.email }, jwtSecret);

  return jsonResponse({
    token,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
  });
}

/**
 * GET /api/auth/me
 *
 * Validates JWT from Authorization: Bearer header.
 * Returns user info (id, email, created_at).
 */
async function handleMe(request, env) {
  // Extract token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return jsonResponse({ error: 'Internal server error' }, 500);
  }

  // Verify and decode JWT
  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }

  // Look up user by ID to ensure they still exist
  const userJson = await env.USERS_KV.get(`user:id:${payload.sub}`);
  if (!userJson) {
    return jsonResponse({ error: 'User not found' }, 404);
  }

  const user = JSON.parse(userJson);

  return jsonResponse({
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
  });
}

/**
 * Health check endpoint.
 * Does not leak internal configuration details.
 */
function handleHealth() {
  return jsonResponse({
    status: 'ok',
    service: 'writer-app-auth',
    timestamp: new Date().toISOString(),
  });
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
        return handleOptions();
      }

      // Health check (GET only)
      if (path === '/' || path === '/health') {
        if (request.method !== 'GET') {
          return jsonResponse({ error: 'Method not allowed' }, 405);
        }
        return handleHealth();
      }

      // Auth routes
      if (path === '/api/auth/register') {
        if (request.method !== 'POST') {
          return jsonResponse({ error: 'Method not allowed' }, 405);
        }
        return handleRegister(request, env);
      }

      if (path === '/api/auth/login') {
        if (request.method !== 'POST') {
          return jsonResponse({ error: 'Method not allowed' }, 405);
        }
        return handleLogin(request, env);
      }

      if (path === '/api/auth/me') {
        if (request.method !== 'GET') {
          return jsonResponse({ error: 'Method not allowed' }, 405);
        }
        return handleMe(request, env);
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch {
      // Global error handler: never leak internal details or stack traces
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};
