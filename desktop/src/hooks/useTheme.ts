import { useState, useEffect, useCallback } from 'react';
import type { Theme } from '../styles/design-system';

const THEME_STORAGE_KEY = 'writer-theme';

/**
 * Check if we are running in a browser environment.
 * Guards against SSR or test environments where window/document
 * and localStorage are not available.
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Read the stored theme preference from localStorage.
 * Returns null if not set, not available, or invalid.
 */
function getStoredTheme(): Theme | null {
  if (!isBrowser()) return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage might not be available (private browsing, etc.)
  }
  return null;
}

/**
 * Detect the system preference (light or dark).
 * Returns 'light' if detection is not available.
 */
function getSystemTheme(): Theme {
  if (!isBrowser()) return 'light';
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // matchMedia not available
  }
  return 'light';
}

/**
 * Determine the initial theme: stored preference > system preference > light.
 */
function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

/**
 * Hook for managing light/dark theme.
 * Mirrors the mobile app's theme switching from FloatingMenu.
 * Persists the user's preference to localStorage.
 *
 * SSR-safe: all browser API access is guarded by isBrowser() checks.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);

  // Apply theme to document and persist
  useEffect(() => {
    if (!isBrowser()) return;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    if (!isBrowser()) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set a preference
      const stored = getStoredTheme();
      if (!stored) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev: Theme) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const isDark = theme === 'dark';

  return { theme, setTheme, toggleTheme, isDark };
}
