/**
 * Smoke test for auth worker utilities.
 * Run with: node --experimental-vm-modules test.mjs
 *
 * This tests the pure utility functions extracted from worker.js.
 * It does NOT test KV or the full request/response cycle (that requires wrangler dev).
 */

// We cannot directly import from worker.js in Node without a Cloudflare Workers runtime,
// so we replicate the core functions here for validation.

const { subtle } = globalThis.crypto;

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
  return computedHash === storedHash;
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

async function verifyJWT(token, secret) {
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
}

// -- Validation --
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
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

  console.log('--- Password Validation ---');
  assert(isValidPassword('12345678'), '8-char password accepted');
  assert(isValidPassword('a very long password with spaces'), 'Long password accepted');
  assert(!isValidPassword('1234567'), '7-char password rejected');
  assert(!isValidPassword(''), 'Empty password rejected');
  assert(!isValidPassword(null), 'null rejected');

  console.log('--- Password Hashing ---');
  const { hash, salt } = await hashPassword('mypassword123');
  assert(typeof hash === 'string' && hash.length > 0, 'Hash is a non-empty string');
  assert(typeof salt === 'string' && salt.length > 0, 'Salt is a non-empty string');

  const verified = await verifyPassword('mypassword123', hash, salt);
  assert(verified === true, 'Correct password verifies');

  const wrongPassword = await verifyPassword('wrongpassword', hash, salt);
  assert(wrongPassword === false, 'Wrong password fails verification');

  // Different hash each time due to random salt
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

  console.log('--- Base64url roundtrip ---');
  const original = JSON.stringify({ hello: 'world', num: 42 });
  const encoded = base64urlEncode(original);
  const decoded = base64urlDecode(encoded);
  assert(decoded === original, 'Base64url roundtrip preserves data');
  assert(!encoded.includes('+'), 'No + in base64url');
  assert(!encoded.includes('/'), 'No / in base64url');
  assert(!encoded.includes('='), 'No = padding in base64url');

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
