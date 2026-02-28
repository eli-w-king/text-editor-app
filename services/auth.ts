import AsyncStorage from '@react-native-async-storage/async-storage';

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
 * Register a new user account.
 * Stores the JWT token in AsyncStorage on success.
 */
export async function register(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(errorData.error || 'Registration failed');
  }

  const data: AuthResponse = await response.json();
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  return data;
}

/**
 * Log in with existing credentials.
 * Stores the JWT token in AsyncStorage on success.
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(errorData.error || 'Invalid email or password');
  }

  const data: AuthResponse = await response.json();
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  return data;
}

/**
 * Log out the current user by clearing the stored token.
 */
export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/**
 * Retrieve the stored JWT token from AsyncStorage.
 * Returns null if no token is stored.
 */
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
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
        await AsyncStorage.removeItem(TOKEN_KEY);
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
