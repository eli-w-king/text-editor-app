// PLATFORM: Mobile (React Native + Expo)
// COUNTERPART: desktop/src/context/AuthContext.tsx (web, uses localStorage)
//
// SECURITY NOTE: This module intentionally contains zero console.log/warn/error
// statements to prevent accidental leakage of tokens, passwords, or email addresses.
//
// This provider wraps the app and provides authentication state to all children.
// AuthGate reads isLoading + isAuthenticated to decide what to render.
// LoginScreen/RegisterScreen read login/register, error, clearError, isSubmitting.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '../services/auth';
import {
  login as authLogin,
  register as authRegister,
  logout as authLogout,
  getCurrentUser,
} from '../services/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthContextType {
  user: User | null;
  /** True only during the initial session/token validation on mount. */
  isLoading: boolean;
  /** True while a login or register API call is in-flight. */
  isSubmitting: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Context -- default is null; useAuth() throws if used outside a provider.
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default-deny posture: user starts null, isLoading starts true.
  // AuthGate shows a LoadingScreen until isLoading becomes false.
  // Children (protected content) NEVER render during loading.
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard against setting state after the provider unmounts.
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Ref-based guard for double-tap prevention. Refs are always current in
  // async callbacks, unlike React state which batches updates and can produce
  // stale closures.
  const submittingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Session restoration on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const existingUser = await getCurrentUser();
        if (!cancelled && mountedRef.current) {
          setUser(existingUser); // null if no valid token
        }
      } catch {
        // getCurrentUser should never throw (returns null on failure), but
        // guard defensively. User stays null -- unauthenticated.
        if (!cancelled && mountedRef.current) {
          setUser(null);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // login and register use isSubmitting (NOT isLoading) so the parent does
  // not flip back to a splash/loading screen while credentials are submitted.
  // ---------------------------------------------------------------------------

  const login = useCallback(async (email: string, password: string) => {
    // Prevent double-tap from firing concurrent requests.
    if (submittingRef.current) return;
    submittingRef.current = true;

    if (mountedRef.current) {
      setError(null);
      setIsSubmitting(true);
    }

    try {
      const response = await authLogin(email, password);
      if (mountedRef.current) {
        setUser(response.user);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
      }
      // Re-throw so LoginScreen catch block can run (it swallows the error,
      // but needs the catch to avoid an unhandled promise rejection).
      throw err;
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    if (mountedRef.current) {
      setError(null);
      setIsSubmitting(true);
    }

    try {
      const response = await authRegister(email, password);
      if (mountedRef.current) {
        setUser(response.user);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
      }
      throw err;
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Logout sets user null SYNCHRONOUSLY before the async SecureStore deletion.
  // This means isAuthenticated goes false immediately, and AuthGate stops
  // rendering protected content with zero delay.
  // ---------------------------------------------------------------------------

  const logout = useCallback(() => {
    if (mountedRef.current) {
      setUser(null);
      setError(null);
    }
    // Fire-and-forget: if SecureStore deletion fails, the user is already
    // visually logged out. On next mount, getCurrentUser() will fail to
    // validate, effectively completing the logout.
    authLogout().catch(() => {});
  }, []);

  const clearError = useCallback(() => {
    if (mountedRef.current) {
      setError(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSubmitting,
        isAuthenticated: user !== null,
        login,
        register,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
