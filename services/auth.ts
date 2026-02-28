/**
 * Mobile Auth Service (React Native + expo-secure-store)
 *
 * PLATFORM: Mobile (React Native / Expo)
 * COUNTERPART: desktop/src/services/auth.ts (web, localStorage-based)
 *
 * SECURITY NOTES:
 * - Tokens are stored in expo-secure-store which uses the iOS Keychain and
 *   Android Keystore for encrypted, hardware-backed storage.
 * - This module intentionally contains ZERO console.log/warn/error statements
 *   to prevent accidental leakage of tokens, passwords, or email addresses.
 * - Input validation (validateInputs) trims emails and rejects empty fields
 *   before any network call.
 * - Network errors in login/register are caught and re-thrown with a
 *   user-friendly message.
 * - getCurrentUser() preserves the stored token on network errors (offline)
 *   and only deletes it on an explicit 401 from the server.
 * - All response.json() calls are wrapped in try/catch to handle non-JSON
 *   responses (e.g., proxy returning "Forbidden" text, HTML error pages).
 *   This prevents [SyntaxError: JSON Parse error: Unexpected character: F].
 */

import * as SecureStore from 'expo-secure-store';

const API_BASE = 'https://writer-app-auth.inlaynoteapp.workers.dev';
const TOKEN_KEY = 'writer_auth_token';
const USER_KEY = 'writer_auth_user';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ---------------------------------------------------------------------------
// Input Validation
// ---------------------------------------------------------------------------

/**
 * Validate and sanitize auth inputs.
 * Trims email; throws early if email or password are empty.
 * @returns The trimmed email string.
 */
function validateInputs(email: string, password: string): string {
  if (typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('Email is required.');
  }
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required.');
  }
  return email.trim();
}

// ---------------------------------------------------------------------------
// JSON Parse Safety
// ---------------------------------------------------------------------------

/**
 * Safely parse a Response body as JSON. Returns the parsed object or null
 * if the body is not valid JSON (e.g., proxy returned "Forbidden", HTML
 * error page, empty body, etc.).
 *
 * This prevents the raw [SyntaxError: JSON Parse error: Unexpected character: F]
 * that occurs when calling response.json() on a non-JSON response.
 */
async function safeJsonParse(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Response Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a parsed response body matches the expected AuthResponse shape.
 * Returns the validated AuthResponse or null if the shape is invalid.
 */
function validateAuthResponse(data: unknown): AuthResponse | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.token !== 'string' || obj.token.length === 0) {
    return null;
  }

  const user = obj.user;
  if (user === null || typeof user !== 'object') {
    return null;
  }

  const userObj = user as Record<string, unknown>;
  if (
    typeof userObj.id !== 'string' || userObj.id.length === 0 ||
    typeof userObj.email !== 'string' || userObj.email.length === 0
  ) {
    return null;
  }

  return {
    token: obj.token as string,
    user: {
      id: userObj.id as string,
      email: userObj.email as string,
      created_at: (typeof userObj.created_at === 'string' ? userObj.created_at : '') as string,
    },
  };
}

/**
 * Validate that a parsed response body matches the expected User shape.
 * The /api/auth/me endpoint may return { user: { ... } } or the user directly.
 * Returns the validated User or null if the shape is invalid.
 */
function validateUserResponse(data: unknown): User | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // The API may return { user: { id, email, ... } } or { id, email, ... }
  const candidate = (
    obj.user !== null && typeof obj.user === 'object'
      ? obj.user
      : obj
  ) as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string' || candidate.id.length === 0 ||
    typeof candidate.email !== 'string' || candidate.email.length === 0
  ) {
    return null;
  }

  return {
    id: candidate.id as string,
    email: candidate.email as string,
    created_at: (typeof candidate.created_at === 'string' ? candidate.created_at : '') as string,
  };
}

// ---------------------------------------------------------------------------
// Auth API Functions
// ---------------------------------------------------------------------------

/**
 * Register a new user account.
 * Stores the JWT token and user data in expo-secure-store (encrypted) on success.
 *
 * @throws {Error} If inputs are invalid, the network is unreachable,
 *   the server returns an error, or the response shape is unexpected.
 */
export async function register(email: string, password: string): Promise<AuthResponse> {
  const sanitizedEmail = validateInputs(email, password);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sanitizedEmail, password }),
    });
  } catch {
    throw new Error('Network error. Please check your connection and try again.');
  }

  if (!response.ok) {
    // Error responses: try to extract a message, fall back to generic.
    // safeJsonParse prevents SyntaxError if the error body is not JSON.
    const errorData = await safeJsonParse(response);
    const message = (errorData && typeof errorData === 'object'
      ? (errorData as Record<string, string>).error
      : null) || 'Registration failed';
    throw new Error(message);
  }

  // JSON parse safety: if the server returns 200 OK but with a non-JSON body
  // (e.g., HTML from a misconfigured proxy), safeJsonParse returns null
  // instead of throwing a raw SyntaxError.
  const rawData = await safeJsonParse(response);
  const data = validateAuthResponse(rawData);
  if (!data) {
    throw new Error('Server returned an unexpected response. Please try again later.');
  }
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
  return data;
}

/**
 * Log in with existing credentials.
 * Stores the JWT token and user data in expo-secure-store (encrypted) on success.
 *
 * @throws {Error} If inputs are invalid, the network is unreachable,
 *   the server returns an error, or the response shape is unexpected.
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const sanitizedEmail = validateInputs(email, password);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sanitizedEmail, password }),
    });
  } catch {
    throw new Error('Network error. Please check your connection and try again.');
  }

  if (!response.ok) {
    // safeJsonParse prevents SyntaxError on non-JSON error bodies
    const errorData = await safeJsonParse(response);
    const message = (errorData && typeof errorData === 'object'
      ? (errorData as Record<string, string>).error
      : null) || 'Invalid email or password';
    throw new Error(message);
  }

  // JSON parse safety: safeJsonParse returns null for non-JSON bodies
  // instead of throwing [SyntaxError: JSON Parse error: Unexpected character: F]
  const rawData = await safeJsonParse(response);
  const data = validateAuthResponse(rawData);
  if (!data) {
    throw new Error('Server returned an unexpected response. Please try again later.');
  }
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
  return data;
}

/**
 * Log out the current user by clearing all stored auth data.
 */
export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

/**
 * Retrieve the stored JWT token from secure storage.
 * Returns null if no token is stored.
 */
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/**
 * Retrieve the cached user object from secure storage (no network call).
 * Returns null if no user is stored or the stored data is malformed.
 */
export async function getStoredUser(): Promise<User | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validateUserResponse(parsed);
  } catch {
    // JSON parse error or SecureStore failure -- treat as no cached user
    return null;
  }
}

/**
 * Fetch the current authenticated user from the API.
 * Returns null if no token is stored or the token is invalid/expired.
 *
 * Token handling:
 *   - If the server returns 401 (token invalid/revoked), the token is
 *     cleared from secure storage and null is returned.
 *   - If a network error occurs (offline, DNS failure), the token is
 *     PRESERVED (not cleared) and null is returned. This allows the user
 *     to retry when connectivity is restored.
 *   - If the server returns a non-401 error (e.g. 500), the token is
 *     also preserved and null is returned.
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Only clear the token on explicit 401 (invalid/revoked).
      // On other server errors (500, 502, etc.), preserve the token.
      if (response.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
      }
      return null;
    }

    // JSON parse safety: safeJsonParse returns null for non-JSON bodies
    // (e.g., proxy returning "Forbidden" text) instead of throwing SyntaxError.
    const rawData = await safeJsonParse(response);
    const user = validateUserResponse(rawData);

    // Update the cached user with fresh server data
    if (user) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    }

    return user;
  } catch {
    // Network error -- do NOT clear the token.
    // The user may be offline; the token could still be valid.
    return null;
  }
}
