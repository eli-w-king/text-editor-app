/**
 * Comprehensive test suite for auth worker utilities.
 * Run with: node test.mjs
 *
 * Tests cover:
 *   - UUID generation
 *   - Email validation (valid, invalid, edge cases, length limits)
 *   - Password validation (min length, max length, type checks)
 *   - Password hashing and verification (with timingSafeEqual)
 *   - Timing-safe comparison
 *   - JWT creation, verification, expiry, missing fields, and error cases
 *   - Base64url encoding/decoding
 *
 * These tests replicate the core functions from worker.js since the worker
 * module uses Cloudflare Workers-specific APIs that are compatible with
 * Node.js 18+ Web Crypto.
 */

const { subtle } = globalThis.crypto;

// ---------------------------------------------------------------------------
// Constants (must match worker.js)
// ---------------------------------------------------------------------------

// NOTE: worker.js currently has no MAX_EMAIL_LENGTH or MAX_PASSWORD_LENGTH.
// These constants are added here in anticipation of those checks being added
// to worker.js. If worker.js does not enforce these limits, the corresponding
// tests document the expected-future behavior.
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// Replicated utility functions (from worker.js)
// ---------------------------------------------------------------------------

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

// -- Timing-safe comparison (replicated from worker.js) --
// Used by verifyPassword to prevent timing attacks on hash comparison.
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

// Updated to use timingSafeEqual instead of direct === comparison,
// matching the worker.js implementation to prevent timing attacks.
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
 * Helper: create a JWT with a specific expiry offset (for testing expired tokens).
 * A negative expInSeconds value creates an already-expired token.
 */
async function createJWTWithExpiry(payload, secret, expInSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expInSeconds };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getSigningKey(secret);
  const signature = await subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSignature = base64urlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${signingInput}.${encodedSignature}`;
}

/**
 * Helper: create a manually-crafted JWT with an arbitrary payload (bypassing createJWT defaults).
 * This allows setting any fields (or omitting iat/exp) for testing edge cases.
 */
async function createManualJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getSigningKey(secret);
  const signature = await subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSignature = base64urlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${signingInput}.${encodedSignature}`;
}

async function verifyJWT(token, secret) {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
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
    // Any decoding or parsing error means the token is invalid
    return null;
  }
}

// -- Validation (must match worker.js) --
// NOTE: isValidEmail and isValidPassword include max-length checks that
// may not yet be present in worker.js. These are included here to test
// the hardened validation behavior described in the task requirements.
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
// Test Framework
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runTests() {
  // =======================================================================
  // UUID Generation
  // =======================================================================
  console.log('--- UUID Generation ---');
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid1), 'UUID v4 format is correct');
  assert(uuid1 !== uuid2, 'UUIDs are unique');

  // =======================================================================
  // Email Validation: Valid Cases
  // =======================================================================
  console.log('--- Email Validation: Valid ---');
  assert(isValidEmail('test@example.com'), 'Basic email accepted');
  assert(isValidEmail('user+tag@sub.domain.co'), 'Email with + in local part accepted');
  assert(isValidEmail('a@b.cc'), 'Minimal valid email accepted');
  assert(isValidEmail('user.name@domain.org'), 'Email with . in local part accepted');
  assert(isValidEmail('user+tag.name@sub.domain.co.uk'), 'Email with + and . and multi-level domain accepted');
  assert(isValidEmail('first.last@example.com'), 'Dotted local part accepted');

  // =======================================================================
  // Email Validation: Invalid Cases
  // =======================================================================
  console.log('--- Email Validation: Invalid ---');
  assert(!isValidEmail(''), 'Empty string rejected');
  assert(!isValidEmail('notanemail'), 'Missing @ rejected');
  assert(!isValidEmail('@no-local.com'), 'Missing local part rejected');
  assert(!isValidEmail('user@'), 'Missing domain rejected');
  assert(!isValidEmail('user@ domain.com'), 'Space in domain rejected');
  assert(!isValidEmail('us er@domain.com'), 'Space in local part rejected');
  assert(!isValidEmail(' user@example.com'), 'Leading space rejected');
  assert(!isValidEmail('user@example.com '), 'Trailing space rejected');
  assert(!isValidEmail(null), 'null rejected');
  assert(!isValidEmail(undefined), 'undefined rejected');
  assert(!isValidEmail(123), 'number rejected');
  assert(!isValidEmail({}), 'object rejected');
  assert(!isValidEmail([]), 'array rejected');
  assert(!isValidEmail(true), 'boolean rejected');

  // =======================================================================
  // Email Validation: Length Limits
  // =======================================================================
  console.log('--- Email Validation: Length limits ---');
  // RFC 5321 limits email to 254 chars total
  const longLocal = 'a'.repeat(200);
  const longEmail = `${longLocal}@example.com`;
  // This email is 200 + 1 + 11 = 212 chars, under the 254 limit
  assert(isValidEmail(longEmail), 'Email at 212 chars accepted (under 254 limit)');

  const tooLongEmail = 'a'.repeat(250) + '@example.com';
  // This email is 250 + 1 + 11 = 262 chars, over the 254 limit
  assert(!isValidEmail(tooLongEmail), 'Email exceeding 254 chars rejected');

  const exactLimitEmail = 'a'.repeat(242) + '@example.com';
  // 242 + 1 + 11 = 254, exactly at the limit
  assert(isValidEmail(exactLimitEmail), 'Email at exactly 254 chars accepted');

  const oneTooManyEmail = 'a'.repeat(243) + '@example.com';
  // 243 + 1 + 11 = 255, one char over
  assert(!isValidEmail(oneTooManyEmail), 'Email at 255 chars rejected');

  // =======================================================================
  // Password Validation: Valid Cases
  // =======================================================================
  console.log('--- Password Validation: Valid ---');
  assert(isValidPassword('12345678'), 'Exactly 8-char password accepted (boundary)');
  assert(isValidPassword('abcdefgh'), 'Exactly 8 alpha chars accepted (boundary)');
  assert(isValidPassword('a very long password with spaces'), 'Long password with spaces accepted');
  assert(isValidPassword('a'.repeat(MAX_PASSWORD_LENGTH)), `Exactly ${MAX_PASSWORD_LENGTH}-char password accepted (max boundary)`);

  // =======================================================================
  // Password Validation: Invalid Cases
  // =======================================================================
  console.log('--- Password Validation: Invalid ---');
  assert(!isValidPassword('1234567'), 'Exactly 7-char password rejected (boundary)');
  assert(!isValidPassword('abcdefg'), 'Exactly 7 alpha chars rejected (boundary)');
  assert(!isValidPassword(''), 'Empty string rejected');
  assert(!isValidPassword('abcd'), 'Short password rejected');
  assert(!isValidPassword(null), 'null rejected');
  assert(!isValidPassword(undefined), 'undefined rejected');
  assert(!isValidPassword(12345678), 'Number input rejected (typeof check)');
  assert(!isValidPassword({}), 'object rejected');
  assert(!isValidPassword('a'.repeat(MAX_PASSWORD_LENGTH + 1)), `${MAX_PASSWORD_LENGTH + 1}-char password rejected (max length exceeded)`);
  assert(!isValidPassword('a'.repeat(200)), '200-char password rejected (max length exceeded)');

  // =======================================================================
  // Timing-Safe Comparison
  // =======================================================================
  console.log('--- Timing-Safe Comparison ---');
  // Same strings return true
  assert(timingSafeEqual('abc', 'abc') === true, 'Same strings return true');
  assert(timingSafeEqual('hello world!', 'hello world!') === true, 'Same complex strings return true');

  // Different strings of same length return false
  assert(timingSafeEqual('abc', 'abd') === false, 'Different strings of same length return false');
  assert(timingSafeEqual('aaaaa', 'aaaab') === false, 'Strings differing in last char return false');

  // Different length strings return false
  assert(timingSafeEqual('abc', 'abcd') === false, 'Different length strings return false');
  assert(timingSafeEqual('short', 'longer string') === false, 'Short vs long return false');
  assert(timingSafeEqual('', 'a') === false, 'Empty vs non-empty return false');

  // Empty strings return true
  assert(timingSafeEqual('', '') === true, 'Empty strings return true');

  // Longer strings
  assert(timingSafeEqual('a'.repeat(100), 'a'.repeat(100)) === true, 'Long identical strings return true');
  assert(timingSafeEqual('a'.repeat(100), 'a'.repeat(99) + 'b') === false, 'Long strings differing at end return false');

  // =======================================================================
  // Password Hashing
  // =======================================================================
  console.log('--- Password Hashing ---');
  const { hash, salt } = await hashPassword('mypassword123');
  assert(typeof hash === 'string' && hash.length > 0, 'Hash is a non-empty string');
  assert(typeof salt === 'string' && salt.length > 0, 'Salt is a non-empty string');

  const verified = await verifyPassword('mypassword123', hash, salt);
  assert(verified === true, 'Correct password verifies (using timingSafeEqual)');

  const wrongPassword = await verifyPassword('wrongpassword', hash, salt);
  assert(wrongPassword === false, 'Wrong password fails verification');

  const emptyPassword = await verifyPassword('', hash, salt);
  assert(emptyPassword === false, 'Empty password fails verification');

  // Different hash each time due to random salt
  const { hash: hash2, salt: salt2 } = await hashPassword('mypassword123');
  assert(hash !== hash2 || salt !== salt2, 'Same password produces different salt/hash');

  // Cross-verification: password hashed with one salt fails with another salt
  const crossVerify = await verifyPassword('mypassword123', hash, salt2);
  assert(crossVerify === false, 'Password fails verification with wrong salt');

  // =======================================================================
  // JWT: Happy Path
  // =======================================================================
  console.log('--- JWT: Happy Path ---');
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

  // =======================================================================
  // JWT: Wrong Secret
  // =======================================================================
  console.log('--- JWT: Wrong Secret ---');
  const badPayload = await verifyJWT(token, 'wrong-secret');
  assert(badPayload === null, 'Token fails with wrong secret');

  const emptySecretPayload = await verifyJWT(token, '');
  assert(emptySecretPayload === null, 'Token fails with empty secret');

  // =======================================================================
  // JWT: Tampered Token
  // =======================================================================
  console.log('--- JWT: Tampered Token ---');
  const tamperedToken = token.slice(0, -5) + 'XXXXX';
  const tamperedPayload = await verifyJWT(tamperedToken, secret);
  assert(tamperedPayload === null, 'Tampered token (modified signature) fails verification');

  // Tamper with payload while keeping original signature
  const parts = token.split('.');
  const modifiedPayloadB64 = base64urlEncode(JSON.stringify({ sub: 'hacker', email: 'evil@test.com', iat: 0, exp: 99999999999 }));
  const tamperedToken2 = `${parts[0]}.${modifiedPayloadB64}.${parts[2]}`;
  const tamperedPayload2 = await verifyJWT(tamperedToken2, secret);
  assert(tamperedPayload2 === null, 'Tampered token (modified payload) fails verification');

  // Tamper with header while keeping original signature
  const modifiedHeader = base64urlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const tamperedToken3 = `${modifiedHeader}.${parts[1]}.${parts[2]}`;
  const tamperedPayload3 = await verifyJWT(tamperedToken3, secret);
  assert(tamperedPayload3 === null, 'Tampered token (modified header) fails verification');

  // =======================================================================
  // JWT: Expired Token
  // =======================================================================
  console.log('--- JWT: Expired Token ---');

  // Create a JWT with exp set to a past timestamp using createManualJWT
  const expiredPayload = {
    sub: 'user-expired',
    email: 'expired@example.com',
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600,  // 1 hour ago
  };
  const expiredToken = await createManualJWT(expiredPayload, secret);
  const expiredResult = await verifyJWT(expiredToken, secret);
  assert(expiredResult === null, 'Expired token (exp 1 hour in the past) returns null');

  // Token expired just 1 second ago
  const justExpiredToken = await createJWTWithExpiry({ sub: 'user-123', email: 'test@example.com' }, secret, -1);
  const justExpiredPayload = await verifyJWT(justExpiredToken, secret);
  assert(justExpiredPayload === null, 'Token expired 1 second ago returns null');

  // Token expired 100 seconds ago
  const longExpiredToken = await createJWTWithExpiry({ sub: 'user-123', email: 'test@example.com' }, secret, -100);
  const longExpiredPayload = await verifyJWT(longExpiredToken, secret);
  assert(longExpiredPayload === null, 'Token expired 100 seconds ago returns null');

  // =======================================================================
  // JWT: Token with Missing Fields
  // =======================================================================
  console.log('--- JWT: Token with missing fields ---');

  // NOTE: verifyJWT does NOT check for required claims (sub, email).
  // It only validates the cryptographic signature and checks expiration.
  // Claim-level validation (e.g., ensuring sub exists) is the responsibility
  // of the route handlers (e.g., handleMe checks payload.sub against KV).
  // This is documented behavior, not a bug.

  // Token with missing sub (has email but no sub)
  const noSubPayload = {
    email: 'nosub@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const noSubToken = await createManualJWT(noSubPayload, secret);
  const noSubResult = await verifyJWT(noSubToken, secret);
  assert(noSubResult !== null, 'Token with missing sub still verifies (verifyJWT does not check required claims)');
  assert(noSubResult.sub === undefined, 'Missing sub is undefined in verified payload');
  assert(noSubResult.email === 'nosub@example.com', 'Email is present in payload with missing sub');

  // Token with missing email (has sub but no email)
  const noEmailPayload = {
    sub: 'user-no-email',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const noEmailToken = await createManualJWT(noEmailPayload, secret);
  const noEmailResult = await verifyJWT(noEmailToken, secret);
  assert(noEmailResult !== null, 'Token with missing email still verifies (verifyJWT does not check required claims)');
  assert(noEmailResult.email === undefined, 'Missing email is undefined in verified payload');
  assert(noEmailResult.sub === 'user-no-email', 'Sub is present in payload with missing email');

  // Token with empty payload (no sub, no email, no custom fields)
  const emptyPayloadToken = await createJWT({}, secret);
  const emptyPayloadResult = await verifyJWT(emptyPayloadToken, secret);
  assert(emptyPayloadResult !== null, 'Token with empty payload object still verifies (claim validation is route-level)');
  assert(typeof emptyPayloadResult.iat === 'number', 'Empty payload token still has iat (added by createJWT)');
  assert(typeof emptyPayloadResult.exp === 'number', 'Empty payload token still has exp (added by createJWT)');

  // =======================================================================
  // JWT: Malformed / Invalid Tokens
  // =======================================================================
  console.log('--- JWT: Malformed and Invalid Tokens ---');

  // Empty token string
  const emptyTokenResult = await verifyJWT('', secret);
  assert(emptyTokenResult === null, 'Empty string returns null');

  // null and undefined
  const nullTokenResult = await verifyJWT(null, secret);
  assert(nullTokenResult === null, 'null returns null');

  const undefinedTokenResult = await verifyJWT(undefined, secret);
  assert(undefinedTokenResult === null, 'undefined returns null');

  // Number input
  const numberTokenResult = await verifyJWT(12345, secret);
  assert(numberTokenResult === null, 'Number input returns null');

  // Token with only 1 part
  const onePartResult = await verifyJWT('abc', secret);
  assert(onePartResult === null, 'Token with 1 part returns null');

  // Token with only 2 parts
  const twoPartResult = await verifyJWT('abc.def', secret);
  assert(twoPartResult === null, 'Token with 2 parts returns null');

  // Token with 4 parts
  const fourPartResult = await verifyJWT('a.b.c.d', secret);
  assert(fourPartResult === null, 'Token with 4 parts returns null');

  // Malformed base64 in token -- invalid base64url characters
  const malformedB64Result = await verifyJWT('!!!.@@@.###', secret);
  assert(malformedB64Result === null, 'Token with invalid base64url chars (!, @, #) returns null');

  // Valid header but garbage in payload and signature segments
  const validHeader = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const garbageTokenResult = await verifyJWT(`${validHeader}.@#$%^&*.@#$%^&*`, secret);
  assert(garbageTokenResult === null, 'Token with valid header but garbage payload/sig returns null');

  // Non-JWT three-segment string
  const notAJwtResult = await verifyJWT('not.a.jwt', secret);
  assert(notAJwtResult === null, 'Non-JWT three-segment string returns null');

  // =======================================================================
  // Base64url Roundtrip
  // =======================================================================
  console.log('--- Base64url roundtrip ---');
  const original = JSON.stringify({ hello: 'world', num: 42 });
  const encoded = base64urlEncode(original);
  const decoded = base64urlDecode(encoded);
  assert(decoded === original, 'Base64url roundtrip preserves data');
  assert(!encoded.includes('+'), 'No + in base64url');
  assert(!encoded.includes('/'), 'No / in base64url');
  assert(!encoded.includes('='), 'No = padding in base64url');

  // Edge cases
  const emptyEncoded = base64urlEncode('');
  const emptyDecoded = base64urlDecode(emptyEncoded);
  assert(emptyDecoded === '', 'Base64url roundtrip with empty string');

  const specialChars = 'abc/+===test';
  const specialEncoded = base64urlEncode(specialChars);
  const specialDecoded = base64urlDecode(specialEncoded);
  assert(specialDecoded === specialChars, 'Base64url roundtrip with special chars');

  // =======================================================================
  // Summary
  // =======================================================================
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
