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
  /** Returns true on success, false on failure (error is set in state). */
  login: (email: string, password: string) => Promise<boolean>;
  /** Returns true on success, false on failure (error is set in state). */
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Context -- undefined default forces consumers to use the AuthProvider
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
//
// Race condition mitigations:
//   1. submittingRef (a ref, not state) prevents concurrent login/register
//      calls from double-taps. State-based guards are insufficient because
//      React batches state updates and the second call's closure may still
//      see the pre-update value of isSubmitting.
//   2. mountedRef prevents setState after the provider unmounts.
//   3. A `cancelled` flag in the checkAuth effect prevents stale responses
//      from a previous mount cycle (React StrictMode or fast navigation)
//      from updating state.
//   4. logout() sets user to null SYNCHRONOUSLY (before async cleanup) to
//      eliminate any flash of authenticated content.
//   5. login/register return a boolean (true = success, false = error).
//      They do NOT re-throw errors. The error is captured in context state
//      and read reactively by consumers. Re-throwing forced every consumer
//      to wrap calls in try/catch or risk unhandled promise rejections.
//      The boolean return lets consumers conditionally navigate without
//      relying on exceptions for control flow.
// ---------------------------------------------------------------------------

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default-deny posture: user starts null, isLoading starts true.
  // The app should show a loading/splash screen until isLoading becomes
  // false. This prevents any flash of authenticated or unauthenticated
  // content during the initial session check.
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard against setting state after the provider unmounts.
  const mountedRef = useRef(true);

  // Ref-based guard against concurrent login/register calls.
  // Refs are synchronously updated and always current regardless of
  // closure timing, unlike state which may be stale in an async callback.
  const submittingRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // On mount, validate any existing token. We do NOT optimistically set the
  // user from localStorage -- the loading screen covers this period and
  // avoids a brief flash of authenticated state if the token is expired.
  //
  // Flow:
  //   1. isLoading=true, user=null -- app shows loading screen
  //   2. check if a token exists in localStorage
  //   3a. No token -> isLoading=false, user stays null -> show login
  //   3b. Token exists -> call getCurrentUser() to validate with server
  //   4a. Valid -> setUser(validatedUser), isLoading=false -> show app
  //   4b. Invalid/expired -> getCurrentUser returns null, user stays null,
  //       isLoading=false -> show login
  //   4c. Network error -> getCurrentUser returns null (token preserved),
  //       user stays null, isLoading=false -> show login (token kept for
  //       next attempt when connectivity returns)
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      // Fast path: no token stored at all -- skip network call
      if (!authService.isAuthenticated()) {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
        return;
      }

      // Validate the token with the server. getCurrentUser() returns the
      // user on success, or null on any failure (expired, network error,
      // server error). It never throws under normal conditions.
      const validatedUser = await authService.getCurrentUser();

      if (!cancelled && mountedRef.current) {
        setUser(validatedUser); // null if token was invalid/expired
        setIsLoading(false);
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // login and register use isSubmitting (not isLoading) so the parent does
  // not flip back to a splash/loading screen while the user is submitting
  // credentials. isLoading is only for the initial mount session check.
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Ref-based double-tap guard -- synchronous, always current
    if (submittingRef.current) return false;
    if (!mountedRef.current) return false;

    submittingRef.current = true;
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authService.login(email, password);
      if (mountedRef.current) {
        setUser(result.user);
      }
      return true;
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
      }
      // Do NOT re-throw. The error is captured in context state and
      // displayed reactively by the consumer component. The boolean
      // return lets consumers conditionally navigate.
      return false;
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Ref-based double-tap guard -- synchronous, always current
    if (submittingRef.current) return false;
    if (!mountedRef.current) return false;

    submittingRef.current = true;
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authService.register(email, password);
      if (mountedRef.current) {
        setUser(result.user);
      }
      return true;
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
      }
      // Same as login -- do not re-throw. Error is in context state.
      return false;
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, []);

  const logout = useCallback(() => {
    // Set user to null SYNCHRONOUSLY first so the UI immediately reflects
    // the logged-out state. Then clear persisted credentials. This ordering
    // prevents any flash of authenticated content after clicking logout.
    if (mountedRef.current) {
      setUser(null);
      setError(null);
    }
    authService.logout();
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
