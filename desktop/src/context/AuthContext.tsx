import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '../services/auth';
import * as authService from '../services/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthContextType {
  user: User | null;
  /** True only during the initial session/token validation on mount. */
  isLoading: boolean;
  /** True while a login or register request is in-flight. */
  isSubmitting: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default deny: user starts null, isLoading starts true so the app shows
  // a loading/splash screen until the initial session check completes.
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

  // On mount, validate any existing token. Do NOT optimistically set the
  // user from localStorage -- the loading screen covers this period and
  // avoids a brief flash of authenticated state if the token is expired.
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (!authService.isAuthenticated()) {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const validatedUser = await authService.getCurrentUser();
        if (!cancelled && mountedRef.current) {
          setUser(validatedUser);
        }
      } catch {
        // Token invalid -- clear any stale data, user stays null.
        if (!cancelled && mountedRef.current) {
          setUser(null);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // login and register use isSubmitting (not isLoading) so the parent does
  // not flip back to a splash/loading screen while the user is submitting
  // credentials.
  const login = useCallback(async (email: string, password: string) => {
    if (!mountedRef.current) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authService.login(email, password);
      if (mountedRef.current) {
        setUser(result.user);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    if (!mountedRef.current) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authService.register(email, password);
      if (mountedRef.current) {
        setUser(result.user);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    if (mountedRef.current) {
      setUser(null);
      setError(null);
    }
  }, []);

  const clearError = useCallback(() => {
    if (mountedRef.current) {
      setError(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSubmitting,
        isAuthenticated: !!user,
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
