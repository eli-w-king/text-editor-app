/**
 * Inlay App Auth Worker for Cloudflare Workers
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
 *   - Origin-based CORS allowlist with credentials support
 *   - Generic registration error to prevent user enumeration
 *   - JWT header algorithm validation (prevents 'alg: none' attack)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_REQUEST_BODY_BYTES = 10 * 1024; // 10 KB
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

// Rate limit settings (per IP, per action, approximate via KV TTL)
// Login: 10 attempts per IP per 15 minutes
const RATE_LIMIT_LOGIN_MAX = 10;
const RATE_LIMIT_LOGIN_WINDOW_SECONDS = 15 * 60;
// Register: 5 attempts per IP per hour
const RATE_LIMIT_REGISTER_MAX = 5;
const RATE_LIMIT_REGISTER_WINDOW_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// CORS Configuration
// ---------------------------------------------------------------------------

/**
 * Allowed origins for CORS. Only these origins receive a reflected
 * Access-Control-Allow-Origin header. Null/empty origin is allowed
 * for Electron desktop apps which send requests without an Origin header.
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
 * Build CORS headers for the given request origin.
 * Reflects the origin back if it is in the allowlist.
 * Allows null/empty origin for Electron desktop apps.
 * Includes Access-Control-Allow-Credentials for cookie/auth support.
 */
function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };

  // Allow null/empty origin for Electron desktop apps
  if (!origin) {
    headers['Access-Control-Allow-Origin'] = 'null';
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  // If origin is not in the allowlist and is not null/empty,
  // no Access-Control-Allow-Origin header is set (browser will block).

  return headers;
}

/**
 * Handle preflight OPTIONS requests.
 */
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a JSON response with CORS headers.
 */
function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
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
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} ip - Client IP address
 * @param {string} action - Rate limit action key
 * @param {number} maxAttempts - Maximum allowed attempts within the window
 * @param {number} windowSeconds - TTL window in seconds
 */
async function checkRateLimit(env, ip, action, maxAttempts, windowSeconds) {
  const key = `ratelimit:${ip}:${action}`;

  try {
    const current = await env.USERS_KV.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= maxAttempts) {
      return false;
    }

    // Increment counter with TTL
    await env.USERS_KV.put(key, String(count + 1), {
      expirationTtl: windowSeconds,
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
    return { data: null, error: jsonResponse(request, { error: 'Request body too large' }, 413) };
  }

  try {
    const text = await request.text();
    if (text.length > MAX_REQUEST_BODY_BYTES) {
      return { data: null, error: jsonResponse(request, { error: 'Request body too large' }, 413) };
    }
    const data = JSON.parse(text);
    return { data, error: null };
  } catch {
    return { data: null, error: jsonResponse(request, { error: 'Invalid JSON body' }, 400) };
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
 *
 * Security checks performed:
 * 1. Input type validation (must be non-empty string)
 * 2. Structure validation (must have exactly 3 dot-separated parts)
 * 3. Algorithm header validation (must be HS256 -- prevents 'alg: none' attack)
 * 4. HMAC-SHA256 signature verification via crypto.subtle
 * 5. Expiration check (rejects tokens where exp < now)
 *
 * Wrapped in try/catch to safely handle any malformed input without
 * leaking internal error details.
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

    // Validate the JWT header algorithm.
    // This prevents the 'alg: none' attack (CVE-2015-9235) where an attacker
    // sets the algorithm to 'none' and sends an unsigned token. By explicitly
    // checking that the header specifies 'HS256', we reject any other algorithm
    // before proceeding to signature verification.
    let header;
    try {
      header = JSON.parse(base64urlDecode(encodedHeader));
    } catch {
      return null;
    }
    if (!header || header.alg !== 'HS256') {
      return null;
    }

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
  // Rate limit check: 5 attempts per IP per hour
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env, ip, 'register', RATE_LIMIT_REGISTER_MAX, RATE_LIMIT_REGISTER_WINDOW_SECONDS);
  if (!allowed) {
    return jsonResponse(request, { error: 'Too many requests. Please try again later.' }, 429);
  }

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { email, password } = body;

  // Validate email
  if (!email || !isValidEmail(email)) {
    return jsonResponse(request, { error: 'Invalid email format' }, 400);
  }

  // Validate password
  if (!password || !isValidPassword(password)) {
    return jsonResponse(
      request,
      { error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters long` },
      400,
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await env.USERS_KV.get(`user:email:${normalizedEmail}`);
  if (existingUser) {
    // Generic message to prevent user enumeration -- do not reveal whether
    // the email is already registered.
    return jsonResponse(request, { error: 'Registration failed. Please try again or sign in if you already have an account.' }, 409);
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
    return jsonResponse(request, { error: 'Internal server error' }, 500);
  }

  const token = await createJWT({ sub: userId, email: normalizedEmail }, jwtSecret);

  return jsonResponse(request, {
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
  // Rate limit check: 10 attempts per IP per 15 minutes
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env, ip, 'login', RATE_LIMIT_LOGIN_MAX, RATE_LIMIT_LOGIN_WINDOW_SECONDS);
  if (!allowed) {
    return jsonResponse(request, { error: 'Too many requests. Please try again later.' }, 429);
  }

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { email, password } = body;

  if (!email || !password) {
    return jsonResponse(request, { error: 'Email and password are required' }, 400);
  }

  // Validate types to prevent unexpected behavior
  if (typeof email !== 'string' || typeof password !== 'string') {
    return jsonResponse(request, { error: 'Email and password must be strings' }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Look up user
  const userJson = await env.USERS_KV.get(`user:email:${normalizedEmail}`);
  if (!userJson) {
    // Use a generic message to avoid leaking whether the email exists
    return jsonResponse(request, { error: 'Invalid email or password' }, 401);
  }

  const user = JSON.parse(userJson);

  // Verify password
  const passwordValid = await verifyPassword(password, user.password_hash, user.salt);
  if (!passwordValid) {
    return jsonResponse(request, { error: 'Invalid email or password' }, 401);
  }

  // Generate JWT
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return jsonResponse(request, { error: 'Internal server error' }, 500);
  }

  const token = await createJWT({ sub: user.id, email: user.email }, jwtSecret);

  return jsonResponse(request, {
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
    return jsonResponse(request, { error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonResponse(request, { error: 'Missing or invalid Authorization header' }, 401);
  }

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return jsonResponse(request, { error: 'Internal server error' }, 500);
  }

  // Verify and decode JWT
  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) {
    return jsonResponse(request, { error: 'Invalid or expired token' }, 401);
  }

  // Look up user by ID to ensure they still exist
  const userJson = await env.USERS_KV.get(`user:id:${payload.sub}`);
  if (!userJson) {
    return jsonResponse(request, { error: 'User not found' }, 404);
  }

  const user = JSON.parse(userJson);

  return jsonResponse(request, {
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
function handleHealth(request) {
  return jsonResponse(request, {
    status: 'ok',
    service: 'inlay-app-auth',
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
        return handleOptions(request);
      }

      // Health check (GET only)
      if (path === '/' || path === '/health') {
        if (request.method !== 'GET') {
          return jsonResponse(request, { error: 'Method not allowed' }, 405);
        }
        return handleHealth(request);
      }

      // Auth routes
      if (path === '/api/auth/register') {
        if (request.method !== 'POST') {
          return jsonResponse(request, { error: 'Method not allowed' }, 405);
        }
        return handleRegister(request, env);
      }

      if (path === '/api/auth/login') {
        if (request.method !== 'POST') {
          return jsonResponse(request, { error: 'Method not allowed' }, 405);
        }
        return handleLogin(request, env);
      }

      if (path === '/api/auth/me') {
        if (request.method !== 'GET') {
          return jsonResponse(request, { error: 'Method not allowed' }, 405);
        }
        return handleMe(request, env);
      }

      return jsonResponse(request, { error: 'Not found' }, 404);
    } catch {
      // Global error handler: never leak internal details or stack traces.
      // Include CORS headers so the browser can read the error response.
      const hdrs = corsHeaders(request);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...hdrs, 'Content-Type': 'application/json' },
      });
    }
  },
};
