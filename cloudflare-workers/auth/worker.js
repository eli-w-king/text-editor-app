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
 *   user:email:{email} -> JSON user object
 *   user:id:{id}       -> JSON user object
 */

// TODO: Add rate limiting for login/register endpoints to prevent brute-force attacks.
// Consider using a sliding window counter in KV with TTL-based expiration.

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

// CORS headers for cross-origin requests (MVP: allow all origins)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, restrict this to your app's domain
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle preflight OPTIONS requests
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
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
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
  // Re-add padding
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
 */
async function verifyJWT(token, secret) {
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
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an email address format.
 */
function isValidEmail(email) {
  // Basic but reasonable email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
}

/**
 * Validate password meets minimum requirements.
 */
function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
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
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { email, password } = body;

  // Validate email
  if (!email || !isValidEmail(email)) {
    return jsonResponse({ error: 'Invalid email format' }, 400);
  }

  // Validate password
  if (!password || !isValidPassword(password)) {
    return jsonResponse(
      { error: 'Password must be at least 8 characters long' },
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
    return jsonResponse({ error: 'Server configuration error: JWT_SECRET not set' }, 500);
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
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { email, password } = body;

  if (!email || !password) {
    return jsonResponse({ error: 'Email and password are required' }, 400);
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
    return jsonResponse({ error: 'Server configuration error: JWT_SECRET not set' }, 500);
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

  const token = authHeader.slice(7); // Remove "Bearer "

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return jsonResponse({ error: 'Server configuration error: JWT_SECRET not set' }, 500);
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
 * Health check endpoint
 */
function handleHealth(env) {
  const hasSecret = !!env.JWT_SECRET;
  return jsonResponse({
    status: 'ok',
    service: 'writer-app-auth',
    configured: hasSecret,
    timestamp: new Date().toISOString(),
  });
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
      return handleOptions();
    }

    // Route requests
    switch (true) {
      case path === '/' || path === '/health':
        return handleHealth(env);

      case path === '/api/auth/register' && request.method === 'POST':
        return handleRegister(request, env);

      case path === '/api/auth/login' && request.method === 'POST':
        return handleLogin(request, env);

      case path === '/api/auth/me' && request.method === 'GET':
        return handleMe(request, env);

      default:
        return jsonResponse({ error: 'Not found' }, 404);
    }
  },
};
