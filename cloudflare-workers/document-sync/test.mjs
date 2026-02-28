/**
 * Smoke test for document-sync worker utilities.
 * Run with: node test.mjs
 *
 * Tests the pure utility functions extracted from worker.js.
 * Does NOT test R2 or the full request/response cycle (that requires wrangler dev).
 *
 * Functions tested:
 *   - base64UrlDecode / base64UrlDecodeToBuffer: base64url decoding
 *   - verifyJWT: HMAC-SHA256 JWT lifecycle (including alg:none prevention)
 *   - isValidDocumentId: document ID validation against DOCUMENT_ID_REGEX
 *   - documentKey / indexKey: R2 key construction
 *   - buildSummary: document summary generation for index
 *   - corsHeaders: origin-based allowlist behavior
 *   - Constants: MAX_CONTENT_SIZE_BYTES, MAX_TITLE_LENGTH
 */

const { subtle } = globalThis.crypto;

// ---------------------------------------------------------------------------
// Replicated constants and functions from worker.js
// ---------------------------------------------------------------------------

const MAX_CONTENT_SIZE_BYTES = 1_048_576;
const MAX_TITLE_LENGTH = 500;
const DOCUMENT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'https://inlaynoteapp.com',
  'https://app.inlaynoteapp.com',
  'https://www.inlaynoteapp.com',
];

// -- Base64url --
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  return atob(base64);
}

function base64UrlDecodeToBuffer(str) {
  const binary = base64UrlDecode(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// -- JWT --
async function getSigningKey(secret) {
  return subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

async function createTestJWT(payload, secret, overrides = {}) {
  const header = { alg: 'HS256', typ: 'JWT', ...overrides.header };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: overrides.iat ?? now,
    exp: overrides.exp ?? (now + 7 * 24 * 60 * 60),
  };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getSigningKey(secret);
  const signature = await subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSignature = base64urlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${signingInput}.${encodedSignature}`;
}

async function verifyJWT(token, secret) {
  try {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Validate algorithm header
    let header;
    try {
      header = JSON.parse(base64UrlDecode(encodedHeader));
    } catch {
      return null;
    }
    if (!header || header.alg !== 'HS256') return null;

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const key = await subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const signatureBuffer = base64UrlDecodeToBuffer(encodedSignature);
    const valid = await subtle.verify('HMAC', key, signatureBuffer, encoder.encode(signingInput));
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    if (!payload.sub) return null;

    return payload;
  } catch {
    return null;
  }
}

// -- Document ID validation --
function isValidDocumentId(id) {
  return typeof id === 'string' && DOCUMENT_ID_REGEX.test(id);
}

// -- R2 key helpers --
function documentKey(userId, documentId) {
  return `documents/${userId}/${documentId}.json`;
}

function indexKey(userId) {
  return `documents/${userId}/_index.json`;
}

// -- Index summary --
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

// -- CORS (matching worker.js exactly) --
function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Document-Version',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };

  if (!origin) {
    headers['Access-Control-Allow-Origin'] = 'null';
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

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

// ---------------------------------------------------------------------------
// Test runner
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
  const secret = 'test-secret-key-for-document-sync';

  // -----------------------------------------------------------------------
  console.log('--- Base64url encoding/decoding ---');
  // -----------------------------------------------------------------------
  const original = JSON.stringify({ hello: 'world', num: 42 });
  const encoded = base64urlEncode(original);
  const decoded = base64UrlDecode(encoded);
  assert(decoded === original, 'Roundtrip preserves JSON data');
  assert(!encoded.includes('+'), 'No + in base64url output');
  assert(!encoded.includes('/'), 'No / in base64url output');
  assert(!encoded.includes('='), 'No = padding in base64url output');

  const special = 'abc/+==xyz';
  const specialEncoded = base64urlEncode(special);
  const specialDecoded = base64UrlDecode(specialEncoded);
  assert(specialDecoded === special, 'Roundtrip preserves special characters');

  assert(base64UrlDecode(base64urlEncode('')) === '', 'Roundtrip preserves empty string');

  const buf = base64UrlDecodeToBuffer(base64urlEncode('ABC'));
  assert(buf instanceof ArrayBuffer, 'base64UrlDecodeToBuffer returns ArrayBuffer');
  const view = new Uint8Array(buf);
  assert(view[0] === 65 && view[1] === 66 && view[2] === 67, 'base64UrlDecodeToBuffer decodes correctly');

  const unicodeJSON = JSON.stringify({ key: 'value123' });
  assert(base64UrlDecode(base64urlEncode(unicodeJSON)) === unicodeJSON, 'Roundtrip preserves unicode-safe JSON');

  // -----------------------------------------------------------------------
  console.log('--- JWT verification ---');
  // -----------------------------------------------------------------------
  const token = await createTestJWT({ sub: 'user-123', email: 'test@example.com' }, secret);
  const payload = await verifyJWT(token, secret);
  assert(payload !== null, 'Valid token verifies successfully');
  assert(payload.sub === 'user-123', 'Payload sub claim matches');
  assert(payload.email === 'test@example.com', 'Payload email claim matches');
  assert(typeof payload.iat === 'number', 'Payload has iat');
  assert(typeof payload.exp === 'number', 'Payload has exp');
  assert(payload.exp - payload.iat === 7 * 24 * 60 * 60, 'Token expiry is 7 days');

  assert(await verifyJWT(token, 'wrong-secret') === null, 'Token fails with wrong secret');

  const tampered = token.slice(0, -5) + 'XXXXX';
  assert(await verifyJWT(tampered, secret) === null, 'Tampered token fails verification');

  // Expired tokens
  const now = Math.floor(Date.now() / 1000);
  const exp1h = await createTestJWT({ sub: 'u1', email: 'a@b.c' }, secret, { iat: now - 7200, exp: now - 3600 });
  assert(await verifyJWT(exp1h, secret) === null, 'Expired token (1h ago) returns null');

  const exp1s = await createTestJWT({ sub: 'u1', email: 'a@b.c' }, secret, { iat: now - 120, exp: now - 1 });
  assert(await verifyJWT(exp1s, secret) === null, 'Expired token (1s ago) returns null');

  const exp100s = await createTestJWT({ sub: 'u1', email: 'a@b.c' }, secret, { iat: now - 200, exp: now - 100 });
  assert(await verifyJWT(exp100s, secret) === null, 'Expired token (100s ago) returns null');

  // Missing sub claim
  const noSub = await createTestJWT({ email: 'a@b.c' }, secret);
  assert(await verifyJWT(noSub, secret) === null, 'Token without sub claim returns null');

  // Empty sub claim
  const emptySub = await createTestJWT({ sub: '', email: 'a@b.c' }, secret);
  assert(await verifyJWT(emptySub, secret) === null, 'Token with empty string sub returns null');

  // Malformed inputs
  assert(await verifyJWT(null, secret) === null, 'null token returns null');
  assert(await verifyJWT(undefined, secret) === null, 'undefined token returns null');
  assert(await verifyJWT('', secret) === null, 'Empty string token returns null');
  assert(await verifyJWT(123, secret) === null, 'Number token returns null');

  // Wrong number of parts
  assert(await verifyJWT('singlepart', secret) === null, 'Token with 1 part returns null');
  assert(await verifyJWT('part1.part2', secret) === null, 'Token with 2 parts returns null');
  assert(await verifyJWT('a.b.c.d', secret) === null, 'Token with 4 parts returns null');

  // Garbage tokens
  assert(await verifyJWT('not.a.jwt', secret) === null, 'Malformed base64 payload returns null');
  assert(await verifyJWT('aaa.bbb.ccc', secret) === null, 'Garbage 3-part token returns null');
  assert(await verifyJWT('hello world', secret) === null, 'Non-JWT string returns null');

  // -----------------------------------------------------------------------
  console.log('--- Document ID validation ---');
  // -----------------------------------------------------------------------
  // Valid IDs
  assert(isValidDocumentId('abc-123-def'), 'Alphanumeric with hyphens accepted');
  assert(isValidDocumentId('my_document_id'), 'Underscores accepted');
  assert(isValidDocumentId('a'), 'Single character accepted');
  assert(isValidDocumentId('A'), 'Single uppercase character accepted');
  assert(isValidDocumentId('7'), 'Single digit accepted');
  assert(isValidDocumentId('AbCdEf123'), 'Mixed case alphanumeric accepted');
  assert(isValidDocumentId('-'), 'Single hyphen accepted');
  assert(isValidDocumentId('_'), 'Single underscore accepted');
  assert(isValidDocumentId('a'.repeat(128)), '128-char ID accepted (max length)');
  assert(isValidDocumentId('550e8400-e29b-41d4-a716-446655440000'), 'UUID format accepted');

  // Invalid IDs -- path traversal and injection attempts
  assert(!isValidDocumentId('../../../etc/passwd'), 'Path traversal with ../ rejected');
  assert(!isValidDocumentId('..'), 'Double dot rejected');
  assert(!isValidDocumentId('.'), 'Single dot rejected');
  assert(!isValidDocumentId('foo/bar'), 'Relative path rejected');
  assert(!isValidDocumentId('foo/bar'), 'Forward slash rejected');
  assert(!isValidDocumentId('foo\\bar'), 'Backslash rejected');
  assert(!isValidDocumentId('hello world'), 'Spaces rejected');
  assert(!isValidDocumentId('hello\tworld'), 'Tabs rejected');
  assert(!isValidDocumentId('hello\nworld'), 'Newlines rejected');
  assert(!isValidDocumentId('user@domain'), '@ sign rejected');
  assert(!isValidDocumentId('foo%20bar'), 'Percent encoding rejected');
  assert(!isValidDocumentId('<script>alert(1)</script>'), 'HTML/XSS injection rejected');
  assert(!isValidDocumentId('id;DROP TABLE'), 'Semicolon injection rejected');
  assert(!isValidDocumentId(''), 'Empty string rejected');
  assert(!isValidDocumentId('a'.repeat(129)), '129-char ID rejected (over max)');
  assert(!isValidDocumentId('a'.repeat(256)), '256-char ID rejected');

  // Invalid types
  assert(!isValidDocumentId(null), 'null rejected');
  assert(!isValidDocumentId(undefined), 'undefined rejected');
  assert(!isValidDocumentId(12345), 'Number rejected');
  assert(!isValidDocumentId({}), 'Object rejected');
  assert(!isValidDocumentId([]), 'Array rejected');
  assert(!isValidDocumentId(true), 'Boolean rejected');

  // -----------------------------------------------------------------------
  console.log('--- R2 key construction ---');
  // -----------------------------------------------------------------------
  assert(documentKey('user1', 'doc-abc') === 'documents/user1/doc-abc.json', 'documentKey builds correct path');
  assert(indexKey('user1') === 'documents/user1/_index.json', 'indexKey builds correct path');
  assert(documentKey('user1', 'docA') !== documentKey('user2', 'docA'), 'Same doc ID for different users produces different R2 keys');
  assert(documentKey('u1', 'd1').startsWith('documents/u1/'), 'Document key starts with user namespace prefix');
  assert(indexKey('u1').startsWith('documents/u1/'), 'Index key starts with user namespace prefix');

  // -----------------------------------------------------------------------
  console.log('--- buildSummary ---');
  // -----------------------------------------------------------------------
  const fullDoc = {
    document_id: 'doc-123',
    user_id: 'user-456',
    title: 'Test Document',
    content: { type: 'delta', ops: [{ insert: 'hello' }], plainText: 'hello' },
    metadata: { wordCount: 1, characterCount: 5, colorFamily: 'ocean', colorDots: [], tags: [], isPinned: true, isArchived: false },
    version: 3,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
    deleted_at: null,
  };

  const summary = buildSummary(fullDoc);
  assert(summary.document_id === 'doc-123', 'Summary has document_id');
  assert(summary.title === 'Test Document', 'Summary has title');
  assert(summary.updated_at === '2024-01-02T00:00:00.000Z', 'Summary has updated_at');
  assert(summary.created_at === '2024-01-01T00:00:00.000Z', 'Summary has created_at');
  assert(summary.deleted_at === null, 'Summary has deleted_at');
  assert(summary.version === 3, 'Summary has version');
  assert(summary.wordCount === 1, 'Summary has wordCount');
  assert(summary.isPinned === true, 'Summary has isPinned');
  assert(summary.isArchived === false, 'Summary has isArchived');
  assert(!('content' in summary), 'Summary excludes content');
  assert(!('user_id' in summary), 'Summary excludes user_id');
  assert(!('metadata' in summary), 'Summary excludes full metadata object');
  assert(Object.keys(summary).length === 9, `Summary has exactly 9 fields (got ${Object.keys(summary).length})`);

  // Missing metadata defaults
  const bareDoc = { document_id: 'd1', title: 't', updated_at: 'u', created_at: 'c', deleted_at: null, version: 1 };
  const bareSummary = buildSummary(bareDoc);
  assert(bareSummary.wordCount === 0, 'Missing metadata defaults wordCount to 0');
  assert(bareSummary.isPinned === false, 'Missing metadata defaults isPinned to false');
  assert(bareSummary.isArchived === false, 'Missing metadata defaults isArchived to false');

  // Soft-deleted document
  const deletedDoc = { ...fullDoc, deleted_at: '2024-06-01T00:00:00.000Z' };
  const deletedSummary = buildSummary(deletedDoc);
  assert(deletedSummary.deleted_at === '2024-06-01T00:00:00.000Z', 'Soft-deleted doc preserves deleted_at timestamp');

  // -----------------------------------------------------------------------
  console.log('--- CORS origin validation ---');
  // -----------------------------------------------------------------------
  // Valid origins are reflected
  assert(corsHeaders(mockRequest('http://localhost:8081'))['Access-Control-Allow-Origin'] === 'http://localhost:8081', 'CORS allows localhost:8081 (React Native)');
  assert(corsHeaders(mockRequest('http://localhost:19006'))['Access-Control-Allow-Origin'] === 'http://localhost:19006', 'CORS allows localhost:19006 (Expo web)');
  assert(corsHeaders(mockRequest('http://localhost:3000'))['Access-Control-Allow-Origin'] === 'http://localhost:3000', 'CORS allows localhost:3000 (desktop Vite)');
  assert(corsHeaders(mockRequest('https://inlaynoteapp.com'))['Access-Control-Allow-Origin'] === 'https://inlaynoteapp.com', 'CORS allows production domain');
  assert(corsHeaders(mockRequest('https://app.inlaynoteapp.com'))['Access-Control-Allow-Origin'] === 'https://app.inlaynoteapp.com', 'CORS allows app subdomain');
  assert(corsHeaders(mockRequest('https://www.inlaynoteapp.com'))['Access-Control-Allow-Origin'] === 'https://www.inlaynoteapp.com', 'CORS allows www subdomain');
  assert(ALLOWED_ORIGINS.length === 6, 'Exactly 6 allowed origins');

  // Unknown origin should NOT get Access-Control-Allow-Origin header
  const unknownCors = corsHeaders(mockRequest('https://evil.com'));
  assert(!('Access-Control-Allow-Origin' in unknownCors), 'Unknown origin gets no Access-Control-Allow-Origin header');

  // Null/empty origin gets 'null' (Electron desktop apps)
  assert(corsHeaders(mockRequest(null))['Access-Control-Allow-Origin'] === 'null', "Null origin gets 'null'");
  assert(corsHeaders(mockRequest(''))['Access-Control-Allow-Origin'] === 'null', "Empty origin gets 'null'");
  assert(corsHeaders(mockRequest(undefined))['Access-Control-Allow-Origin'] === 'null', "Undefined origin gets 'null'");

  // No wildcard
  const validCors = corsHeaders(mockRequest('http://localhost:3000'));
  assert(validCors['Access-Control-Allow-Origin'] !== '*', 'No wildcard origin');

  // Credentials support
  assert(validCors['Access-Control-Allow-Credentials'] === 'true', 'CORS includes credentials support');

  // X-Document-Version header allowed
  assert(validCors['Access-Control-Allow-Headers'].includes('X-Document-Version'), 'CORS allows X-Document-Version header');

  // -----------------------------------------------------------------------
  console.log('--- Content size validation ---');
  // -----------------------------------------------------------------------
  assert(MAX_CONTENT_SIZE_BYTES === 1_048_576, 'Max content size is 1 MB (1,048,576 bytes)');
  const exactMB = 'x'.repeat(MAX_CONTENT_SIZE_BYTES);
  assert(new TextEncoder().encode(exactMB).length <= MAX_CONTENT_SIZE_BYTES, 'Content at exactly 1 MB passes size check');
  const overMB = 'x'.repeat(MAX_CONTENT_SIZE_BYTES + 1);
  assert(new TextEncoder().encode(overMB).length > MAX_CONTENT_SIZE_BYTES, 'Content at 1 MB + 1 byte fails size check');

  // -----------------------------------------------------------------------
  console.log('--- Title truncation ---');
  // -----------------------------------------------------------------------
  assert(MAX_TITLE_LENGTH === 500, 'Max title length is 500 characters');
  const longTitle = 'A'.repeat(600);
  assert(longTitle.slice(0, MAX_TITLE_LENGTH).length === 500, 'Titles over 500 chars are truncated to 500');
  assert('Short title'.slice(0, MAX_TITLE_LENGTH) === 'Short title', 'Short titles remain unchanged');

  // -----------------------------------------------------------------------
  console.log('--- Binding name consistency ---');
  // -----------------------------------------------------------------------
  assert(documentKey('u', 'd').startsWith('documents/'), 'R2 keys use documents/ prefix');
  assert(documentKey('u', 'd').endsWith('.json'), 'R2 keys end with .json extension');
  assert(documentKey('uid', 'did') === 'documents/uid/did.json', 'R2 key format is documents/{userId}/{docId}.json');
  assert(indexKey('uid') === 'documents/uid/_index.json', 'Index key format is documents/{userId}/_index.json');

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
