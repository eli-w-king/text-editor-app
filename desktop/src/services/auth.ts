/**
 * Desktop Auth Service
 * PLATFORM: Web (desktop)
 * COUNTERPART: services/auth.ts (mobile -- uses expo-secure-store)
 *
 * Token storage: localStorage is the standard approach for web SPAs.
 * This is acceptable for MVP but has XSS tradeoffs -- any script running
 * on the page can read the token. The ideal production hardening is to
 * migrate to HttpOnly cookies with a server-side session (BFF pattern),
 * which prevents client-side JavaScript from accessing the session token
 * entirely.
 *
 * SECURITY: Zero console.log/warn/error statements in this file to
 * prevent accidental credential leakage in browser devtools.
 */

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'https://writer-app-auth.inlaynoteapp.workers.dev';

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
// Safe localStorage wrappers (handles private browsing, quota, etc.)
// ---------------------------------------------------------------------------

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage disabled -- silently fail
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage disabled -- silently fail
  }
}

// ---------------------------------------------------------------------------
// Input validation (matches mobile services/auth.ts pattern)
// ---------------------------------------------------------------------------

function validateInputs(email: string, password: string): { trimmedEmail: string } {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    throw new Error('Email is required.');
  }
  if (!password) {
    throw new Error('Password is required.');
  }
  return { trimmedEmail };
}

// ---------------------------------------------------------------------------
// JWT expiration check (client-side fast path before network validation)
// ---------------------------------------------------------------------------

function base64UrlDecode(str: string): string {
  // Replace URL-safe characters back to standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Pad to multiple of 4
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  try {
    return atob(base64);
  } catch {
    return '';
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (!payload.exp) return false; // No expiration claim -- treat as valid

    // 30-second clock skew buffer
    return payload.exp < Date.now() / 1000 - 30;
  } catch {
    // Malformed token -- treat as expired
    return true;
  }
}

// ---------------------------------------------------------------------------
// Response validation helpers
// ---------------------------------------------------------------------------

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('Content-Type') || '';
  return contentType.includes('application/json');
}

function validateAuthResponse(data: unknown): AuthResponse {
  if (
    data &&
    typeof data === 'object' &&
    'token' in data &&
    typeof (data as AuthResponse).token === 'string' &&
    'user' in data &&
    typeof (data as AuthResponse).user === 'object' &&
    (data as AuthResponse).user !== null
  ) {
    const user = (data as AuthResponse).user;
    if (user.id && user.email) {
      return data as AuthResponse;
    }
  }
  throw new Error('Server returned an invalid response.');
}

function validateUserResponse(data: unknown): User | null {
  if (!data || typeof data !== 'object') return null;

  // The /me endpoint may return { user: {...} } or the user object directly
  const candidate = ('user' in data && (data as { user: User }).user) || (data as User);
  if (candidate && candidate.id && candidate.email) {
    return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auth API functions
// ---------------------------------------------------------------------------

/**
 * Register a new user account.
 */
export async function register(email: string, password: string): Promise<AuthResponse> {
  const { trimmedEmail } = validateInputs(email, password);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });
  } catch {
    throw new Error('Network error. Please check your connection and try again.');
  }

  if (!response.ok) {
    if (!isJsonResponse(response)) {
      throw new Error('Server is temporarily unavailable. Please try again later.');
    }
    const error = await response.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(error.message || error.error || 'Registration failed');
  }

  if (!isJsonResponse(response)) {
    throw new Error('Server returned an unexpected response.');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Server returned an invalid response.');
  }

  const result = validateAuthResponse(data);
  storageSet(TOKEN_KEY, result.token);
  storageSet(USER_KEY, JSON.stringify(result.user));

  return result;
}

/**
 * Log in with existing credentials.
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const { trimmedEmail } = validateInputs(email, password);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });
  } catch {
    throw new Error('Network error. Please check your connection and try again.');
  }

  if (!response.ok) {
    if (!isJsonResponse(response)) {
      throw new Error('Server is temporarily unavailable. Please try again later.');
    }
    const error = await response.json().catch(() => ({ message: 'Invalid email or password' }));
    throw new Error(error.message || error.error || 'Invalid email or password');
  }

  if (!isJsonResponse(response)) {
    throw new Error('Server returned an unexpected response.');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Server returned an invalid response.');
  }

  const result = validateAuthResponse(data);
  storageSet(TOKEN_KEY, result.token);
  storageSet(USER_KEY, JSON.stringify(result.user));

  return result;
}

/**
 * Validate the current token by calling GET /api/auth/me.
 * Returns the user if valid, null if invalid.
 *
 * IMPORTANT: Network errors do NOT call logout(). The token is preserved
 * so the user is not forcibly logged out when offline. Only explicit
 * 401/403 from the server triggers logout (token is definitively invalid).
 */
export async function validateToken(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;

  // Fast path: check if the token is expired client-side before making a
  // network request. This avoids unnecessary latency and server load.
  if (isTokenExpired(token)) {
    logout();
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/auth/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch {
    // Network error -- preserve the token. The user may be offline.
    return null;
  }

  if (response.status === 401 || response.status === 403) {
    // Token is definitively invalid -- clear it
    logout();
    return null;
  }

  if (!response.ok) {
    // Server error (500, 502, etc.) -- preserve the token, return null
    return null;
  }

  if (!isJsonResponse(response)) {
    return null;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return null;
  }

  const user = validateUserResponse(data);
  if (user) {
    storageSet(USER_KEY, JSON.stringify(user));
  }
  return user;
}

/**
 * Get the current authenticated user by validating the stored token.
 * Alias for validateToken -- used by AuthContext on mount.
 */
export async function getCurrentUser(): Promise<User | null> {
  return validateToken();
}

/**
 * Log out by clearing stored auth data.
 */
export function logout(): void {
  storageRemove(TOKEN_KEY);
  storageRemove(USER_KEY);
}

/**
 * Get the stored JWT token.
 */
export function getToken(): string | null {
  return storageGet(TOKEN_KEY);
}

/**
 * Get the stored user object from localStorage (no server call).
 */
export function getStoredUser(): User | null {
  const raw = storageGet(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Check if there is a stored, non-expired token (does not validate server-side).
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  return !isTokenExpired(token);
}
