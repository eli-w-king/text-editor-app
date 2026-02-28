// SECURITY NOTE: This module intentionally contains zero console.log/warn/error
// statements to prevent accidental leakage of tokens, passwords, or email addresses.

import * as SecureStore from 'expo-secure-store';

const API_BASE = 'https://writer-app-auth.inlaynoteapp.workers.dev';
const TOKEN_KEY = 'writer_auth_token';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Validate and sanitize auth inputs.
 * Trims email; throws early if email or password are empty.
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

/**
 * Register a new user account.
 * Stores the JWT token in expo-secure-store (encrypted) on success.
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
    const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(errorData.error || 'Registration failed');
  }

  const data: AuthResponse = await response.json();
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  return data;
}

/**
 * Log in with existing credentials.
 * Stores the JWT token in expo-secure-store (encrypted) on success.
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
    const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(errorData.error || 'Invalid email or password');
  }

  const data: AuthResponse = await response.json();
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  return data;
}

/**
 * Log out the current user by clearing the stored token.
 */
export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * Retrieve the stored JWT token from secure storage.
 * Returns null if no token is stored.
 */
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/**
 * Fetch the current authenticated user from the API.
 * Returns null if no token is stored or the token is invalid/expired.
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
      // Token is invalid or expired -- clear it
      if (response.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
      return null;
    }

    const data = await response.json();
    return data.user || data;
  } catch {
    // Network error -- do not clear token (user may be offline)
    return null;
  }
}
