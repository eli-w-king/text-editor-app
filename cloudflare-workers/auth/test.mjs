/**
 * Smoke test for auth worker utilities.
 * Run with: node test.mjs
 *
 * This tests the pure utility functions extracted from worker.js.
 * It does NOT test KV or the full request/response cycle (that requires wrangler dev).
 *
 * Covers:
 * - UUID generation
 * - Email/password validation (including length bounds)
 * - timingSafeEqual constant-time comparison
 * - Password hashing with PBKDF2-SHA256
 * - JWT creation, verification, expiration
 * - JWT algorithm validation (prevents alg:none attack)
 * - CORS origin allowlist validation and function behavior
 * - Base64url encoding/decoding
 */

// We cannot directly import from worker.js in Node without a Cloudflare Workers runtime,
// so we replicate the core functions here for validation.

const { subtle } = globalThis.crypto;

// -- Constants --
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

// CORS origins -- must match the ALLOWED_ORIGINS array in worker.js
const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'https://inlaynoteapp.com',
  'https://app.inlaynoteapp.com',
  'https://www.inlaynoteapp.com',
];

// -- CORS function -- mirrors worker.js corsHeaders() exactly
function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };

  if (!origin) {
    headers['Access-Control-Allow-Origin'] = 'null';
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  // If origin is present but not in allowlist, omit the header entirely.

  return headers;
}

function mockRequest(origin) {
  return {
    headers: {
      get(name) {
        if (name === 'Origin') return origin;
        return null;
      },
    },
  };
}

// -- Base64 utilities --
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

// -- UUID --
function generateUUID() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
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

// -- Password hashing --
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  return {
    hash: arrayBufferToBase64(derivedBits),
    salt: arrayBufferToBase64(salt.buffer),
  };
}

async function verifyPassword(password, storedHash, storedSalt) {
  const salt = base64ToUint8Array(storedSalt);
  const keyMaterial = await subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  const computedHash = arrayBufferToBase64(derivedBits);
  return timingSafeEqual(computedHash, storedHash);
}

// -- timingSafeEqual --
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

// -- JWT --
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function getSigningKey(secret) {
  return subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

async function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 7 * 24 * 60 * 60 };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getSigningKey(secret);
  const signature = await subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSignature = base64urlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${signingInput}.${encodedSignature}`;
}

/**
 * Create a JWT with a custom header object (for algorithm validation tests).
 */
async function createJWTWithHeader(headerObj, payload, secret) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 7 * 24 * 60 * 60 };
  const encodedHeader = base64urlEncode(JSON.stringify(headerObj));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getSigningKey(secret);
  const signature = await subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSignature = base64urlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${signingInput}.${encodedSignature}`;
}

/**
 * verifyJWT -- mirrors worker.js exactly, including algorithm validation.
 */
async function verifyJWT(token, secret) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Validate algorithm header -- rejects alg:none and any non-HS256
    let header;
    try {
      header = JSON.parse(base64urlDecode(encodedHeader));
    } catch {
      return null;
    }
    if (!header || header.alg !== 'HS256') return null;

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const key = await getSigningKey(secret);
    const signatureStr = base64urlDecode(encodedSignature);
    const signatureBytes = new Uint8Array(signatureStr.length);
    for (let i = 0; i < signatureStr.length; i++) {
      signatureBytes[i] = signatureStr.charCodeAt(i);
    }
    const valid = await subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(signingInput));
    if (!valid) return null;
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

// -- Validation --
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > MAX_EMAIL_LENGTH) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.error(`  FAIL: ${name}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- UUID Generation ---');
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid1), 'UUID v4 format is correct');
  assert(uuid1 !== uuid2, 'UUIDs are unique');

  console.log('--- Email Validation ---');
  assert(isValidEmail('test@example.com'), 'Valid email accepted');
  assert(isValidEmail('user+tag@sub.domain.co'), 'Complex valid email accepted');
  assert(!isValidEmail(''), 'Empty string rejected');
  assert(!isValidEmail('notanemail'), 'Missing @ rejected');
  assert(!isValidEmail('@no-local.com'), 'Missing local part rejected');
  assert(!isValidEmail('user@'), 'Missing domain rejected');
  assert(!isValidEmail(null), 'null rejected');
  assert(!isValidEmail(123), 'number rejected');
  const longLocalPart = 'a'.repeat(240);
  assert(isValidEmail(longLocalPart + '@example.com'), 'Email at 252 chars accepted');
  assert(!isValidEmail(longLocalPart + 'bbbbb@example.com'), 'Email over 254 chars rejected');

  console.log('--- Password Validation ---');
  assert(isValidPassword('12345678'), '8-char password accepted');
  assert(isValidPassword('a very long password with spaces'), 'Long password accepted');
  assert(!isValidPassword('1234567'), '7-char password rejected');
  assert(!isValidPassword(''), 'Empty password rejected');
  assert(!isValidPassword(null), 'null rejected');
  assert(isValidPassword('a'.repeat(128)), '128-char password accepted');
  assert(!isValidPassword('a'.repeat(129)), '129-char password rejected');

  console.log('--- timingSafeEqual ---');
  assert(timingSafeEqual('abc', 'abc'), 'Equal strings return true');
  assert(!timingSafeEqual('abc', 'abd'), 'Different strings return false');
  assert(!timingSafeEqual('abc', 'ab'), 'Different length (longer vs shorter) returns false');
  assert(!timingSafeEqual('ab', 'abc'), 'Different length (shorter vs longer) returns false');
  assert(!timingSafeEqual('', 'a'), 'Empty vs non-empty returns false');
  assert(!timingSafeEqual('a', ''), 'Non-empty vs empty returns false');
  assert(timingSafeEqual('', ''), 'Both empty returns true');
  const longStr = 'x'.repeat(10000);
  assert(timingSafeEqual(longStr, longStr), 'Long identical strings return true');
  assert(!timingSafeEqual(longStr, longStr.slice(0, -1) + 'y'), 'Long strings differing at end return false');

  console.log('--- Password Hashing ---');
  const { hash, salt } = await hashPassword('mypassword123');
  assert(typeof hash === 'string' && hash.length > 0, 'Hash is a non-empty string');
  assert(typeof salt === 'string' && salt.length > 0, 'Salt is a non-empty string');
  const verified = await verifyPassword('mypassword123', hash, salt);
  assert(verified === true, 'Correct password verifies');
  const wrongPassword = await verifyPassword('wrongpassword', hash, salt);
  assert(wrongPassword === false, 'Wrong password fails verification');
  const emptyPassword = await verifyPassword('', hash, salt);
  assert(emptyPassword === false, 'Empty password fails verification');
  const { hash: hash2, salt: salt2 } = await hashPassword('mypassword123');
  assert(hash !== hash2 || salt !== salt2, 'Same password produces different salt/hash');

  console.log('--- JWT Creation & Verification ---');
  const secret = 'test-secret-key';
  const token = await createJWT({ sub: 'user-123', email: 'test@example.com' }, secret);
  assert(typeof token === 'string', 'Token is a string');
  assert(token.split('.').length === 3, 'Token has three parts');

  const payload = await verifyJWT(token, secret);
  assert(payload !== null, 'Token verifies with correct secret');
  assert(payload.sub === 'user-123', 'Payload sub matches');
  assert(payload.email === 'test@example.com', 'Payload email matches');
  assert(typeof payload.iat === 'number', 'Payload has iat');
  assert(typeof payload.exp === 'number', 'Payload has exp');
  assert(payload.exp - payload.iat === 7 * 24 * 60 * 60, 'Expiry is 7 days from iat');

  const badPayload = await verifyJWT(token, 'wrong-secret');
  assert(badPayload === null, 'Token fails with wrong secret');

  const tamperedToken = token.slice(0, -5) + 'XXXXX';
  const tamperedPayload = await verifyJWT(tamperedToken, secret);
  assert(tamperedPayload === null, 'Tampered token fails verification');

  const invalidToken = 'not.a.jwt';
  const invalidPayload = await verifyJWT(invalidToken, secret);
  assert(invalidPayload === null, 'Invalid token returns null');

  // Malformed inputs
  const nullResult = await verifyJWT(null, secret);
  assert(nullResult === null, 'null token returns null');
  const undefinedResult = await verifyJWT(undefined, secret);
  assert(undefinedResult === null, 'undefined token returns null');
  const emptyResult = await verifyJWT('', secret);
  assert(emptyResult === null, 'Empty string token returns null');

  // -----------------------------------------------------------------------
  // QA: JWT Algorithm Validation -- prevents 'alg: none' attack (CVE-2015-9235)
  // -----------------------------------------------------------------------
  console.log('--- JWT Algorithm Validation (alg:none prevention) ---');

  // alg:none should be rejected even with valid signature
  const algNoneToken = await createJWTWithHeader(
    { alg: 'none', typ: 'JWT' },
    { sub: 'user-123', email: 'test@example.com' },
    secret,
  );
  const algNoneResult = await verifyJWT(algNoneToken, secret);
  assert(algNoneResult === null, 'Token with alg:none is rejected');

  // alg:HS384 should be rejected (only HS256 is accepted)
  const algHS384Token = await createJWTWithHeader(
    { alg: 'HS384', typ: 'JWT' },
    { sub: 'user-123', email: 'test@example.com' },
    secret,
  );
  const algHS384Result = await verifyJWT(algHS384Token, secret);
  assert(algHS384Result === null, 'Token with alg:HS384 is rejected');

  // alg:RS256 should be rejected
  const algRS256Token = await createJWTWithHeader(
    { alg: 'RS256', typ: 'JWT' },
    { sub: 'user-123', email: 'test@example.com' },
    secret,
  );
  const algRS256Result = await verifyJWT(algRS256Token, secret);
  assert(algRS256Result === null, 'Token with alg:RS256 is rejected');

  // Missing alg field entirely should be rejected
  const noAlgToken = await createJWTWithHeader(
    { typ: 'JWT' },
    { sub: 'user-123', email: 'test@example.com' },
    secret,
  );
  const noAlgResult = await verifyJWT(noAlgToken, secret);
  assert(noAlgResult === null, 'Token with missing alg field is rejected');

  // Correct alg:HS256 should be accepted
  const hs256Token = await createJWTWithHeader(
    { alg: 'HS256', typ: 'JWT' },
    { sub: 'user-123', email: 'test@example.com' },
    secret,
  );
  const hs256Result = await verifyJWT(hs256Token, secret);
  assert(hs256Result !== null, 'Token with alg:HS256 is accepted');
  assert(hs256Result.sub === 'user-123', 'HS256 token has correct sub');

  // Corrupted header (non-JSON base64) should be rejected
  const corruptHeaderToken = base64urlEncode('not-valid-json') + '.' +
    base64urlEncode(JSON.stringify({ sub: 'user-123' })) + '.fakesig';
  const corruptHeaderResult = await verifyJWT(corruptHeaderToken, secret);
  assert(corruptHeaderResult === null, 'Token with non-JSON header is rejected');

  // -----------------------------------------------------------------------
  // QA: JWT Expiration
  // -----------------------------------------------------------------------
  console.log('--- JWT Expiration ---');

  // Create an already-expired token by manually constructing it
  const expNow = Math.floor(Date.now() / 1000);
  const expiredPayload = { sub: 'user-123', email: 'test@example.com', iat: expNow - 3600, exp: expNow - 100 };
  const expHeader = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const expPayloadEncoded = base64urlEncode(JSON.stringify(expiredPayload));
  const expSigningInput = `${expHeader}.${expPayloadEncoded}`;
  const expKey = await getSigningKey(secret);
  const expSig = await subtle.sign('HMAC', expKey, new TextEncoder().encode(expSigningInput));
  const expSigEncoded = base64urlEncode(String.fromCharCode(...new Uint8Array(expSig)));
  const expiredToken = `${expSigningInput}.${expSigEncoded}`;
  const expiredResult = await verifyJWT(expiredToken, secret);
  assert(expiredResult === null, 'Expired token (exp in past) is rejected');

  // Token that expires in 1 second from now should still be valid
  const soonPayload = { sub: 'user-123', email: 'test@example.com', iat: expNow, exp: expNow + 60 };
  const soonPayloadEncoded = base64urlEncode(JSON.stringify(soonPayload));
  const soonSigningInput = `${expHeader}.${soonPayloadEncoded}`;
  const soonSig = await subtle.sign('HMAC', expKey, new TextEncoder().encode(soonSigningInput));
  const soonSigEncoded = base64urlEncode(String.fromCharCode(...new Uint8Array(soonSig)));
  const soonToken = `${soonSigningInput}.${soonSigEncoded}`;
  const soonResult = await verifyJWT(soonToken, secret);
  assert(soonResult !== null, 'Non-expired token (exp in future) is accepted');
  assert(soonResult.sub === 'user-123', 'Non-expired token has correct sub');

  // -----------------------------------------------------------------------
  // QA: CORS Origin Allowlist (no wildcard)
  // -----------------------------------------------------------------------
  console.log('--- CORS Origin Allowlist ---');
  assert(ALLOWED_ORIGINS.length === 6, 'Exactly 6 allowed origins');
  assert(ALLOWED_ORIGINS.includes('http://localhost:8081'), 'localhost:8081 is allowed');
  assert(ALLOWED_ORIGINS.includes('http://localhost:19006'), 'localhost:19006 is allowed');
  assert(ALLOWED_ORIGINS.includes('http://localhost:3000'), 'localhost:3000 is allowed');
  assert(ALLOWED_ORIGINS.includes('https://inlaynoteapp.com'), 'inlaynoteapp.com is allowed');
  assert(ALLOWED_ORIGINS.includes('https://app.inlaynoteapp.com'), 'app.inlaynoteapp.com is allowed');
  assert(ALLOWED_ORIGINS.includes('https://www.inlaynoteapp.com'), 'www.inlaynoteapp.com is allowed');
  assert(!ALLOWED_ORIGINS.includes('*'), 'No wildcard origin in list');

  // -----------------------------------------------------------------------
  // QA: CORS Function Behavior (corsHeaders mirrors worker.js)
  // -----------------------------------------------------------------------
  console.log('--- CORS Function Behavior ---');

  // Valid origins are reflected back
  for (const origin of ALLOWED_ORIGINS) {
    const hdrs = corsHeaders(mockRequest(origin));
    assert(hdrs['Access-Control-Allow-Origin'] === origin, `corsHeaders reflects ${origin}`);
  }

  // Unknown/attacker origin: header is omitted entirely (browser blocks)
  const evilHdrs = corsHeaders(mockRequest('https://evil.com'));
  assert(!('Access-Control-Allow-Origin' in evilHdrs), 'Unknown origin gets no Access-Control-Allow-Origin header');

  // Null origin (Electron desktop apps) gets 'null'
  const nullHdrs = corsHeaders(mockRequest(null));
  assert(nullHdrs['Access-Control-Allow-Origin'] === 'null', "Null origin gets 'null'");

  // Undefined origin (no header at all) gets 'null'
  const undefHdrs = corsHeaders(mockRequest(undefined));
  assert(undefHdrs['Access-Control-Allow-Origin'] === 'null', "Undefined origin gets 'null'");

  // Empty string origin gets 'null' (falsy, treated as absent)
  const emptyOriginHdrs = corsHeaders(mockRequest(''));
  assert(emptyOriginHdrs['Access-Control-Allow-Origin'] === 'null', "Empty string origin gets 'null'");

  // Credentials header is always present
  const validHdrs = corsHeaders(mockRequest('http://localhost:3000'));
  assert(validHdrs['Access-Control-Allow-Credentials'] === 'true', 'CORS includes credentials support');

  // No wildcard in any valid response
  assert(validHdrs['Access-Control-Allow-Origin'] !== '*', 'No wildcard origin in valid CORS response');

  console.log('--- Base64url roundtrip ---');
  const original = JSON.stringify({ hello: 'world', num: 42 });
  const encoded = base64urlEncode(original);
  const decoded = base64urlDecode(encoded);
  assert(decoded === original, 'Base64url roundtrip preserves data');
  assert(!encoded.includes('+'), 'No + in base64url');
  assert(!encoded.includes('/'), 'No / in base64url');
  assert(!encoded.includes('='), 'No = padding in base64url');

  // Summary
  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
